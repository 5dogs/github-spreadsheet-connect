/**
 * スプレッドシートからデータを取得し、シートごとにCSVファイルを作成する関数
 */
function getCSVData() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = spreadsheet.getSheets();
    
    if (sheets.length === 0) {
      throw new Error("シートが見つかりません");
    }
    
    Logger.log("処理対象シート数: " + sheets.length);
    
    var csvFiles = [];
    
    // 各シートのデータを処理
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var sheetName = sheet.getName();
      
      Logger.log("シート処理中: " + sheetName);
      
      var data = sheet.getDataRange().getValues();
      
      if (data.length > 0) {
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
        
                   // ファイル名を生成（シートID + シート名で一意性を保証）
         var sheetId = sheet.getSheetId();
         var fileName = sheetId + '_' + sheetName.replace(/[<>:"/\\|?*]/g, '_') + '.csv';
        
        // Base64エンコード（UTF-8）
        var blob = Utilities.newBlob(csv, 'text/csv', fileName);
        var encodedCSV = Utilities.base64Encode(blob.getBytes());
        
        csvFiles.push({
          fileName: fileName,
          content: encodedCSV,
          sheetName: sheetName,
          rowCount: data.length
        });
        
        Logger.log("✓ " + sheetName + " のCSV作成完了: " + data.length + "行");
      }
    }
    
    Logger.log("全シートのCSVファイル作成完了。ファイル数: " + csvFiles.length);
    return csvFiles;
    
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
    owner: properties.getProperty('GITHUB_OWNER') || "HatenaBase",  // GitHub組織名
    repo: properties.getProperty('GITHUB_REPO') || "kintone-dx-projects",  // リポジトリ名
    path: properties.getProperty('GITHUB_PATH') || "Litpla/docs/LiTPLA様：要件定義書",  // スプレッドシートブックを格納したいファイルへのパス
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
* 01フォルダ内の古いCSVファイルを削除する関数
*/
function cleanupOldFiles(config, headers, currentFileNames) {
  try {
    Logger.log("古いファイルのクリーンアップを開始...");
    
    // 設定で指定したパスのファイル一覧を取得
    var url = "https://api.github.com/repos/" + config.owner + "/" + config.repo + "/contents/" + encodeURIComponent(config.path);
    var response = UrlFetchApp.fetch(url, {
      "method": "GET",
      "headers": headers,
      "muteHttpExceptions": true
    });
    
    if (response.getResponseCode() === 200) {
      var contents = JSON.parse(response.getContentText());
      var deletedCount = 0;
      
      for (var i = 0; i < contents.length; i++) {
        var file = contents[i];
        
        // CSVファイルのみ対象
        if (file.name.endsWith('.csv')) {
          // 現在のファイル名リストに含まれていない場合は削除対象
          if (!currentFileNames.includes(file.name)) {
            Logger.log("古いファイルを削除中: " + file.name);
            
            try {
              var deleteUrl = "https://api.github.com/repos/" + config.owner + "/" + config.repo + "/contents/" + encodeURIComponent(config.path) + "/" + file.name;
              var deletePayload = {
                "message": "Remove old sheet file: " + file.name + " - " + new Date().toLocaleString('ja-JP'),
                "committer": {
                  "name": config.name,
                  "email": config.email
                },
                "sha": file.sha
              };
              
              var deleteResponse = UrlFetchApp.fetch(deleteUrl, {
                "method": "DELETE",
                "headers": Object.assign(headers, {"Content-Type": "application/json"}),
                "payload": JSON.stringify(deletePayload),
                "muteHttpExceptions": true
              });
              
              if (deleteResponse.getResponseCode() === 200) {
                Logger.log("✓ 古いファイル削除成功: " + file.name);
                deletedCount++;
              } else {
                Logger.log("✗ 古いファイル削除失敗: " + file.name + " - " + deleteResponse.getResponseCode());
              }
              
            } catch (deleteError) {
              Logger.log("✗ 古いファイル削除エラー: " + file.name + " - " + deleteError.toString());
            }
          }
        }
      }
      
      Logger.log("クリーンアップ完了: " + deletedCount + "件の古いファイルを削除");
      return deletedCount;
    }
    
  } catch (error) {
    Logger.log("クリーンアップエラー: " + error.toString());
  }
  
  return 0;
}

/**
 * スプレッドシートの内容をGitHubリポジトリにコミットする関数
 */
function pushToGitHub() {
  try {
    Logger.log("GitHub同期を開始します...");
    
    // 処理開始の通知
    SpreadsheetApp.getActiveSpreadsheet().toast("GitHub同期を開始しています...", "処理中", 30);
    
    // ① 設定情報を取得
    var config = getConfig();
    
    // トークンの確認
    if (!config.token) {
      throw new Error("GitHubトークンが設定されていません。スクリプトプロパティに 'GITHUB_TOKEN' を設定してください。");
    }
    
    // ② CSVデータを取得（シートごとに個別ファイル）
    var csvFiles = getCSVData();
    Logger.log("CSVファイル作成完了: " + csvFiles.length + "件");
    
    var results = [];
    
    // ③ 各シートのCSVファイルをGitHubにアップロード
    for (var i = 0; i < csvFiles.length; i++) {
      var csvFile = csvFiles[i];
      var filePath = config.path + "/" + csvFile.fileName; // 設定で指定したパスに配置
      
      // 各シートの処理状況を通知
      SpreadsheetApp.getActiveSpreadsheet().toast(
        csvFile.sheetName + " のデータをアップロード中... (" + (i + 1) + "/" + csvFiles.length + ")", 
        "処理中", 
        10
      );
      
      Logger.log("アップロード中: " + csvFile.sheetName + " → " + filePath);
      
      try {
        // GitHub API URL構築
        var url = "https://api.github.com/repos/" + config.owner + "/" + config.repo + "/contents/" + encodeURIComponent(filePath);
        
        // ヘッダーの設定
        var headers = {
          "Authorization": "Bearer " + config.token,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "GAS-GitHub-Sync"
        };
    
        // 既存ファイルのSHAを取得
        var sha = getExistingFileSHA(url, headers);
        if (sha) {
          Logger.log("既存のファイルSHAを取得: " + sha);
        } else {
          Logger.log("新規ファイルを作成します");
        }
    
        // コミット用のペイロード作成
        var payload = {
          "message": "Update " + csvFile.sheetName + " sheet data - " + new Date().toLocaleString('ja-JP'),
          "committer": {
            "name": config.name,
            "email": config.email
          },
          "content": csvFile.content
        };
        
        // 既存ファイル更新の場合、SHAを追加
        if (sha) {
          payload.sha = sha;
        }
    
        // PUTリクエストのオプション設定
        var options = {
          "method": "PUT",
          "headers": Object.assign(headers, {"Content-Type": "application/json"}),
          "payload": JSON.stringify(payload),
          "muteHttpExceptions": true
        };
    
        // APIリクエスト送信
        var putResponse = UrlFetchApp.fetch(url, options);
        var responseCode = putResponse.getResponseCode();
        var responseText = putResponse.getContentText();
        
        if (responseCode === 200 || responseCode === 201) {
          var responseObj = JSON.parse(responseText);
          Logger.log("✅ " + csvFile.sheetName + " のアップロード成功");
          
          results.push({
            sheetName: csvFile.sheetName,
            fileName: csvFile.fileName,
            success: true,
            commitUrl: responseObj.commit.html_url,
            rowCount: csvFile.rowCount
          });
        } else {
          throw new Error("GitHub API エラー: " + responseCode + " - " + responseText);
        }
        
      } catch (fileError) {
        Logger.log("❌ " + csvFile.sheetName + " のアップロード失敗: " + fileError.toString());
        
        results.push({
          sheetName: csvFile.sheetName,
          fileName: csvFile.fileName,
          success: false,
          error: fileError.toString(),
          rowCount: csvFile.rowCount
        });
      }
    }
    
    // ④ 古いファイルのクリーンアップ
    var currentFileNames = csvFiles.map(function(f) { return f.fileName; });
    var deletedCount = cleanupOldFiles(config, headers, currentFileNames);
    
    // 結果サマリー
    var successCount = results.filter(function(r) { return r.success; }).length;
    var totalCount = results.length;
    
    Logger.log("✅ GitHub同期完了: " + successCount + "/" + totalCount + " 件成功");
    if (deletedCount > 0) {
      Logger.log("🗑️ 古いファイル削除: " + deletedCount + "件");
    }
    
    // 処理完了の通知
    var resultMessage = successCount === totalCount ? 
      "✅ GitHub同期が完了しました！" + successCount + "/" + totalCount + " 件成功" :
      "⚠️ GitHub同期が完了しました。" + successCount + "/" + totalCount + " 件成功";
    
    if (deletedCount > 0) {
      resultMessage += "、古いファイル削除: " + deletedCount + "件";
    }
    
    SpreadsheetApp.getActiveSpreadsheet().toast(resultMessage, "完了", 30);
    
    return {
      success: successCount === totalCount,
      totalFiles: totalCount,
      successFiles: successCount,
      deletedFiles: deletedCount,
      results: results,
      message: "同期完了: " + successCount + "/" + totalCount + " 件成功、古いファイル削除: " + deletedCount + "件"
    };
    
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
    
    Logger.log("=== 設定情報 ===");
    Logger.log("Owner: " + config.owner);
    Logger.log("Repo: " + config.repo);
    Logger.log("Path: " + config.path);
    Logger.log("Token: " + (config.token ? "設定済み" : "未設定"));
    Logger.log("Name: " + config.name);
    Logger.log("Email: " + config.email);
    Logger.log("==================");
    
    if (!config.token) {
      Logger.log("❌ GitHubトークンが設定されていません");
      Logger.log("スクリプトプロパティに 'GITHUB_TOKEN' を設定してください");
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
      Logger.log("リポジトリURL: " + url);
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
    if (trigger.getHandlerFunction() === 'pushToGitHub' || 
        trigger.getHandlerFunction() === 'pullFromGitHub') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 新しいトリガーを作成（例：1時間ごと）
  ScriptApp.newTrigger('pushToGitHub')
    .timeBased()
    .everyHours(1)  // 1時間ごとに実行
    .create();
    
  Logger.log("✅ 自動同期トリガーを設定しました（1時間ごと）");
}

/**
 * GitHubからファイルを取得し、スプレッドシートに反映する関数
 */
function pullFromGitHub() {
  try {
    Logger.log("GitHubからのpullを開始します...");
    
    // 処理開始の通知
    SpreadsheetApp.getActiveSpreadsheet().toast("GitHubからデータを取得中...", "処理中", 30);
    
    // ① 設定情報を取得
    var config = getConfig();
    
    // トークンの確認
    if (!config.token) {
      throw new Error("GitHubトークンが設定されていません。スクリプトプロパティに 'GITHUB_TOKEN' を設定してください。");
    }
    
    // ② GitHubからファイル一覧を取得
    var url = "https://api.github.com/repos/" + config.owner + "/" + config.repo + "/contents/" + encodeURIComponent(config.path);
    var headers = {
      "Authorization": "Bearer " + config.token,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "GAS-GitHub-Sync"
    };
    
    var response = UrlFetchApp.fetch(url, {
      "method": "GET",
      "headers": headers,
      "muteHttpExceptions": true
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error("GitHubからファイル一覧の取得に失敗: " + response.getResponseCode() + " - " + response.getContentText());
    }
    
    var contents = JSON.parse(response.getContentText());
    var csvFiles = contents.filter(function(file) {
      return file.name.endsWith('.csv');
    });
    
    Logger.log("GitHubで見つかったCSVファイル数: " + csvFiles.length);
    
    if (csvFiles.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast("GitHubにCSVファイルが見つかりませんでした", "完了", 10);
      return {
        success: true,
        totalFiles: 0,
        updatedFiles: 0,
        message: "GitHubにCSVファイルが見つかりませんでした"
      };
    }
    
    var results = [];
    var updatedCount = 0;
    
    // ③ 各CSVファイルを処理
    for (var i = 0; i < csvFiles.length; i++) {
      var file = csvFiles[i];
      
      // 各ファイルの処理状況を通知
      SpreadsheetApp.getActiveSpreadsheet().toast(
        file.name + " を処理中... (" + (i + 1) + "/" + csvFiles.length + ")", 
        "処理中", 
        10
      );
      
      Logger.log("処理中: " + file.name);
      
      try {
        // ファイルの内容を取得
        var fileResponse = UrlFetchApp.fetch(file.download_url, {
          "method": "GET",
          "muteHttpExceptions": true
        });
        
        if (fileResponse.getResponseCode() !== 200) {
          throw new Error("ファイル内容の取得に失敗: " + fileResponse.getResponseCode());
        }
        
        var csvContent = fileResponse.getContentText();
        
        // CSVをパースしてデータを取得
        var rows = parseCSV(csvContent);
        
        // ファイル名からシート情報を抽出（Push時と同じロジック）
        var sheetInfo = extractSheetInfoFromFileName(file.name);
        
        if (sheetInfo) {
          // シートが存在するかチェック
          var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
          var sheet = spreadsheet.getSheetByName(sheetInfo.sheetName);
          
          if (!sheet) {
            // シートが存在しない場合は新規作成
            sheet = spreadsheet.insertSheet(sheetInfo.sheetName);
            Logger.log("新規シートを作成: " + sheetInfo.sheetName);
          }
          
          // シートの内容のみをクリア（書式は保持）
          sheet.clearContents();
          
          // データを書き込み
          if (rows.length > 0) {
            sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
            Logger.log("✓ " + sheetInfo.sheetName + " の更新完了: " + rows.length + "行");
            updatedCount++;
          }
          
          results.push({
            fileName: file.name,
            sheetName: sheetInfo.sheetName,
            success: true,
            rowCount: rows.length,
            action: sheet.getSheetId() === sheetInfo.sheetId ? "更新" : "新規作成"
          });
          
        } else {
          Logger.log("⚠️ ファイル名からシート情報を抽出できませんでした: " + file.name);
          results.push({
            fileName: file.name,
            success: false,
            error: "ファイル名からシート情報を抽出できませんでした"
          });
        }
        
      } catch (fileError) {
        Logger.log("❌ " + file.name + " の処理失敗: " + fileError.toString());
        
        results.push({
          fileName: file.name,
          success: false,
          error: fileError.toString()
        });
      }
    }
    
    // 結果サマリー
    var successCount = results.filter(function(r) { return r.success; }).length;
    var totalCount = results.length;
    
    Logger.log("✅ GitHub pull完了: " + successCount + "/" + totalCount + " 件成功、更新: " + updatedCount + "件");
    
    // 処理完了の通知
    var resultMessage = successCount === totalCount ? 
      "✅ GitHubからのpullが完了しました！" + successCount + "/" + totalCount + " 件成功、更新: " + updatedCount + "件" :
      "⚠️ GitHubからのpullが完了しました。" + successCount + "/" + totalCount + " 件成功、更新: " + updatedCount + "件";
    
    SpreadsheetApp.getActiveSpreadsheet().toast(resultMessage, "完了", 30);
    
    return {
      success: successCount === totalCount,
      totalFiles: totalCount,
      successFiles: successCount,
      updatedFiles: updatedCount,
      results: results,
      message: "Pull完了: " + successCount + "/" + totalCount + " 件成功、更新: " + updatedCount + "件"
    };
    
  } catch (error) {
    Logger.log("❌ エラーが発生しました: " + error.toString());
    SpreadsheetApp.getActiveSpreadsheet().toast("❌ エラーが発生しました: " + error.toString(), "エラー", 30);
    throw error;
  }
}

/**
 * CSVファイル名からシート情報を抽出する関数（Push時と同じロジック）
 */
function extractSheetInfoFromFileName(fileName) {
  try {
    // ファイル名の形式: {sheetId}_{sheetName}.csv
    var match = fileName.match(/^(\d+)_(.+)\.csv$/);
    
    if (match) {
      var sheetId = parseInt(match[1]);
      var sheetName = match[2];
      
      return {
        sheetId: sheetId,
        sheetName: sheetName
      };
    }
    
    return null;
  } catch (error) {
    Logger.log("ファイル名解析エラー: " + error.toString());
    return null;
  }
}

/**
 * CSV文字列をパースして2次元配列に変換する関数
 */
function parseCSV(csvContent) {
  try {
    var lines = csvContent.split('\n');
    var result = [];
    
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line === '') continue;
      
      var row = [];
      var current = '';
      var inQuotes = false;
      
      for (var j = 0; j < line.length; j++) {
        var char = line[j];
        
        if (char === '"') {
          if (inQuotes && line[j + 1] === '"') {
            // エスケープされたダブルクォート
            current += '"';
            j++; // 次の文字をスキップ
          } else {
            // クォートの開始/終了
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // カンマ（クォート外）
          row.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      
      // 最後のフィールドを追加
      row.push(current);
      result.push(row);
    }
    
    return result;
  } catch (error) {
    Logger.log("CSVパースエラー: " + error.toString());
    return [];
  }
}





function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('GitHub連携')
    .addItem('GitHubにpushする', 'pushToGitHub')
    .addItem('GitHubからpullする', 'pullFromGitHub')
    .addToUi();
}
