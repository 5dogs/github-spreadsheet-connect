/**
 * スプレッドシートからデータを取得し、CSV形式のBase64文字列に変換する関数
 */
function getCSVData() {
    try {
      // シート名を指定（必要に応じて変更）
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("シート1");
      if (!sheet) {
        throw new Error("指定されたシートが見つかりません");
      }
      
      var data = sheet.getDataRange().getValues();
      
      // CSV形式に変換
      var csv = data.map(function(row) {
        return row.map(function(cell) {
          // null、undefined値を空文字列に変換
          var cellValue = (cell === null || cell === undefined) ? "" : String(cell);
          // CSVエスケープ処理（ダブルクォート、カンマ、改行を含む場合）
          if (cellValue.includes('"') || cellValue.includes(',') || cellValue.includes('\n')) {
            return '"' + cellValue.replace(/"/g, '""') + '"';
          }
          return cellValue;
        }).join(",");
      }).join("\n");
      
      // Base64エンコード（UTF-8）
      var blob = Utilities.newBlob(csv, 'text/csv', 'data.csv');
      var encodedCSV = Utilities.base64Encode(blob.getBytes());
      return encodedCSV;
      
    } catch (error) {
      Logger.log("CSVデータ取得エラー: " + error.toString());
      throw error;
    }
  }
  
  /**
   * 設定情報を取得する関数
   */
  function getConfig() {
    var properties = PropertiesService.getScriptProperties();
    return {
      owner: "5dogs",  // あなたのGitHubユーザー名
      repo: "github-spreadsheet-connect",  // リポジトリ名
      path: "data.csv",  // ファイルパス
      token: properties.getProperty('GITHUB_TOKEN'),  // スクリプトプロパティから取得
      name: properties.getProperty('COMMITTER_NAME') || "GAS Auto Sync",
      email: properties.getProperty('COMMITTER_EMAIL') || "gas-auto-sync@example.com"
    };
  }
  
  /**
   * GitHubの既存ファイル情報を取得する関数
   */
  function getExistingFileSHA(url, headers) {
    var options = {
      "method": "GET",
      "headers": headers,
      "muteHttpExceptions": true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() === 200) {
      var respObj = JSON.parse(response.getContentText());
      return respObj.sha;
    } else if (response.getResponseCode() === 404) {
      // ファイルが存在しない（初回作成）
      return null;
    } else {
      throw new Error("ファイル情報の取得に失敗: " + response.getResponseCode() + " - " + response.getContentText());
    }
  }
  
  /**
   * スプレッドシートの内容をGitHubリポジトリにコミットする関数
   */
  function updateSpreadsheetToGitHub() {
    try {
      Logger.log("GitHub同期を開始します...");
      
      // ① 設定情報を取得
      var config = getConfig();
      
      // トークンの確認
      if (!config.token) {
        throw new Error("GitHubトークンが設定されていません。スクリプトプロパティに 'GITHUB_TOKEN' を設定してください。");
      }
      
      // ② CSVデータを取得
      var encodedContent = getCSVData();
      Logger.log("CSVデータを取得しました");
  
      // ③ GitHub API URL構築
      var url = "https://api.github.com/repos/" + config.owner + "/" + config.repo + "/contents/" + encodeURIComponent(config.path);
      
      // ④ ヘッダーの設定
      var headers = {
        "Authorization": "Bearer " + config.token,  // "token"から"Bearer"に変更
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GAS-GitHub-Sync"
      };
  
      // ⑤ 既存ファイルのSHAを取得
      var sha = getExistingFileSHA(url, headers);
      if (sha) {
        Logger.log("既存のファイルSHAを取得: " + sha);
      } else {
        Logger.log("新規ファイルを作成します");
      }
  
      // ⑥ コミット用のペイロード作成
      var payload = {
        "message": "Update spreadsheet data - " + new Date().toLocaleString('ja-JP'),
        "committer": {
          "name": config.name,
          "email": config.email
        },
        "content": encodedContent
      };
      
      // 既存ファイル更新の場合、SHAを追加
      if (sha) {
        payload.sha = sha;
      }
  
      // ⑦ PUTリクエストのオプション設定
      var options = {
        "method": "PUT",
        "headers": Object.assign(headers, {"Content-Type": "application/json"}),
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true
      };
  
      // ⑧ APIリクエスト送信
      var putResponse = UrlFetchApp.fetch(url, options);
      var responseCode = putResponse.getResponseCode();
      var responseText = putResponse.getContentText();
      
      if (responseCode === 200 || responseCode === 201) {
        var responseObj = JSON.parse(responseText);
        Logger.log("✅ GitHub同期が成功しました！");
        Logger.log("コミットURL: " + responseObj.commit.html_url);
        return {
          success: true,
          commitUrl: responseObj.commit.html_url,
          message: "同期完了"
        };
      } else {
        throw new Error("GitHub API エラー: " + responseCode + " - " + responseText);
      }
      
    } catch (error) {
      Logger.log("❌ エラーが発生しました: " + error.toString());
      throw error;
    }
  }
  
  /**
   * 設定をテストする関数
   */
  function testGitHubConnection() {
    try {
      var config = getConfig();
      
      if (!config.token) {
        Logger.log("❌ GitHubトークンが設定されていません");
        return;
      }
      
      var url = "https://api.github.com/repos/" + config.owner + "/" + config.repo;
      var headers = {
        "Authorization": "Bearer " + config.token,
        "User-Agent": "GAS-GitHub-Sync"
      };
      
      var response = UrlFetchApp.fetch(url, {
        "method": "GET",
        "headers": headers,
        "muteHttpExceptions": true
      });
      
      if (response.getResponseCode() === 200) {
        Logger.log("✅ GitHubリポジトリへの接続テスト成功");
      } else {
        Logger.log("❌ 接続テスト失敗: " + response.getResponseCode() + " - " + response.getContentText());
      }
      
    } catch (error) {
      Logger.log("❌ 接続テストエラー: " + error.toString());
    }
  }
  
  /**
   * 自動実行用のトリガーを設定する関数
   */
  function setupAutoSync() {
    // 既存のトリガーを削除
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === 'updateSpreadsheetToGitHub') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // 新しいトリガーを作成（例：1時間ごと）
    ScriptApp.newTrigger('updateSpreadsheetToGitHub')
      .timeBased()
      .everyHours(1)  // 1時間ごとに実行
      .create();
      
    Logger.log("✅ 自動同期トリガーを設定しました（1時間ごと）");
  }