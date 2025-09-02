# GAS.js ファイル分析とUML図

## 概要

このドキュメントは、Google Apps Script (GAS) でスプレッドシートとGitHubリポジトリを同期する `GAS.js` ファイルの分析結果と、必要なUML図をまとめたものです。

## ファイル分析

### 主要機能
- スプレッドシートからCSVデータを取得
- CSVデータをBase64エンコード
- GitHub APIを使用してリポジトリにコミット
- 自動同期のためのトリガー設定

### 関数一覧
1. `getCSVData()` - CSVデータ取得・変換
2. `getConfig()` - 設定情報取得
3. `getExistingFileSHA()` - 既存ファイルSHA取得
4. `updateSpreadsheetToGitHub()` - メイン同期処理
5. `testGitHubConnection()` - 接続テスト
6. `setupAutoSync()` - 自動同期設定
7. `cleanupOldFiles()` - 古いファイルのクリーンアップ

## UML図

### 1. クラス図

```mermaid
classDiagram
    class GASScript {
        +getCSVData() Array
        +getConfig() Object
        +getExistingFileSHA(url, headers) String
        +updateSpreadsheetToGitHub() Object
        +testGitHubConnection() void
        +setupAutoSync() void
        +cleanupOldFiles(config, headers, currentFileNames) Number
    }
    
    class SpreadsheetService {
        +getActiveSpreadsheet() Spreadsheet
        +getSheets() Array
        +getSheetId() Number
        +getName() String
        +getDataRange() Range
        +getValues() Array
    }
    
    class CSVProcessor {
        +convertToCSV(data) String
        +escapeCSV(cellValue) String
        +base64Encode(csv) String
        +generateFileName(sheetId, sheetName) String
    }
    
    class GitHubAPI {
        +getFileInfo(url, headers) Object
        +updateFile(url, payload, headers) Object
        +deleteFile(url, payload, headers) Object
        +testConnection(url, headers) Boolean
    }
    
    class ConfigManager {
        +getScriptProperties() Properties
        +getProperty(key) String
        +getDefaultConfig() Object
    }
    
    class TriggerManager {
        +getProjectTriggers() Array
        +deleteTrigger(trigger) void
        +newTrigger(functionName) TriggerBuilder
        +timeBased() TimeBasedTriggerBuilder
        +everyHours(hours) TimeBasedTriggerBuilder
        +create() Trigger
    }
    
    class FileCleanup {
        +getRepositoryContents(url, headers) Array
        +deleteOldFiles(files, currentFileNames) Number
        +isCSVFile(fileName) Boolean
    }
    
    GASScript --> SpreadsheetService
    GASScript --> CSVProcessor
    GASScript --> GitHubAPI
    GASScript --> ConfigManager
    GASScript --> TriggerManager
    GASScript --> FileCleanup
```

### 2. シーケンス図（メイン同期処理）

```mermaid
sequenceDiagram
    participant User
    participant GAS as GAS Script
    participant SS as Spreadsheet
    participant GH as GitHub API
    participant Props as Script Properties
    participant Cleanup as File Cleanup
    
    User->>GAS: updateSpreadsheetToGitHub()
    GAS->>Props: getConfig()
    Props-->>GAS: config object
    
    GAS->>SS: getCSVData()
    SS-->>GAS: CSV files array
    
    loop For each CSV file
        GAS->>GH: getExistingFileSHA()
        GH-->>GAS: SHA hash or null
        
        GAS->>GH: PUT /contents/{path}
        Note over GAS,GH: Commit payload with content
        
        alt Success
            GH-->>GAS: 200/201 + commit info
        else Error
            GH-->>GAS: Error code + message
        end
    end
    
    GAS->>Cleanup: cleanupOldFiles()
    Cleanup->>GH: GET /contents/01
    GH-->>Cleanup: files list
    Cleanup->>GH: DELETE old files
    Cleanup-->>GAS: deleted count
    
    GAS-->>User: Results summary
```

### 3. アクティビティ図（CSVデータ処理）

```mermaid
flowchart TD
    A[開始: getCSVData] --> B[スプレッドシート取得]
    B --> C[全シート取得]
    C --> D{シート存在?}
    D -->|No| E[エラー: シートが見つからない]
    D -->|Yes| F[CSVファイル配列初期化]
    
    F --> G[シートループ開始]
    G --> H[シート名取得]
    H --> I[シートID取得]
    I --> J[データ範囲取得]
    J --> K[データ値を取得]
    
    K --> L{データ存在?}
    L -->|No| M[次のシートへ]
    L -->|Yes| N[CSV変換開始]
    
    N --> O[各行を処理]
    O --> P[各セルを処理]
    P --> Q[CSVエスケープ処理]
    Q --> R[ファイル名生成]
    R --> S[Base64エンコード]
    
    S --> T[CSVファイル情報を配列に追加]
    T --> U{全シート処理完了?}
    U -->|No| M
    U -->|Yes| V[完了: CSVファイル配列返却]
    
    M --> U
```

### 4. 状態図（GitHub同期処理）

```mermaid
stateDiagram-v2
    [*] --> 初期化
    初期化 --> 設定取得
    設定取得 --> トークンチェック
    トークンチェック -->|無効| エラー終了
    トークンチェック -->|有効| CSV取得
    CSV取得 -->|失敗| エラー終了
    CSV取得 -->|成功| ファイルアップロードループ
    
    ファイルアップロードループ --> 個別ファイル処理
    個別ファイル処理 --> SHA取得
    SHA取得 -->|存在| ファイル更新
    SHA取得 -->|不存在| 新規作成
    ファイル更新 --> アップロード実行
    新規作成 --> アップロード実行
    
    アップロード実行 -->|成功| 成功記録
    アップロード実行 -->|失敗| 失敗記録
    成功記録 --> 次のファイル確認
    失敗記録 --> 次のファイル確認
    
    次のファイル確認 -->|未完了| 個別ファイル処理
    次のファイル確認 -->|完了| 古いファイルクリーンアップ
    
    古いファイルクリーンアップ --> 結果サマリー
    結果サマリー --> 成功終了
    エラー終了 --> [*]
    成功終了 --> [*]
```

### 5. コンポーネント図

```mermaid
graph TB
    subgraph "Google Apps Script Environment"
        GAS[GAS.js Script]
        SS[Spreadsheet Service]
        Props[Script Properties]
        Trig[Trigger Service]
    end
    
    subgraph "External Services"
        GH[GitHub API]
        CSV[CSV Processing]
        Cleanup[File Cleanup]
    end
    
    subgraph "Data Storage"
        Sheet[Google Spreadsheet]
        Repo[GitHub Repository]
        Token[GitHub Token]
    end
    
    GAS --> SS
    GAS --> Props
    GAS --> Trig
    GAS --> GH
    GAS --> CSV
    GAS --> Cleanup
    SS --> Sheet
    Props --> Token
    GH --> Repo
    Cleanup --> Repo
```

## データフロー

### 入力データ
- Google Spreadsheet の全シートデータ
- スクリプトプロパティ（GitHub Token、コミッター情報）

### 処理フロー
1. **データ抽出**: 各シート → 個別CSV形式
2. **ファイル名生成**: シートID + シート名
3. **データ変換**: CSV → Base64エンコード
4. **API通信**: GitHub Contents API（個別ファイル）
5. **クリーンアップ**: 古いファイルの自動削除
6. **結果記録**: 各ファイルの処理結果を記録

### 出力データ
- GitHubリポジトリの01フォルダ内のCSVファイル群
- コミット履歴
- 実行ログ
- 処理結果サマリー

## 設定項目

### 必須設定
- `GITHUB_TOKEN`: GitHub Personal Access Token
- `owner`: GitHubユーザー名（コード内で設定）
- `repo`: リポジトリ名（コード内で設定）
- `path`: 出力フォルダ（01/）

### オプション設定
- `COMMITTER_NAME`: コミッター名
- `COMMITTER_EMAIL`: コミッターメール

## エラーハンドリング

### 主要エラーケース
1. シートが見つからない
2. GitHubトークンが設定されていない
3. GitHub API通信エラー
4. 個別ファイルのアップロード失敗
5. 古いファイルの削除失敗

### エラー対応
- 個別ファイルの処理失敗時も他のファイルは継続処理
- 適切なエラーメッセージの表示
- ログ出力とエラー記録
- 結果サマリーでの成功/失敗件数の報告

## セキュリティ考慮事項

### 認証
- GitHub Personal Access Token の使用
- スクリプトプロパティでの機密情報管理

### アクセス制御
- リポジトリへの書き込み権限
- トークンの有効期限管理
- ファイル削除時の権限確認

## パフォーマンス最適化

### 実行頻度
- デフォルト: 1時間ごと
- カスタマイズ可能（分、時間、日単位）

### データ処理
- 効率的なCSV変換
- Base64エンコードの最適化
- 個別ファイル処理による並列性

## 拡張性

### 追加可能な機能
- 複数フォルダへの出力
- 差分更新の最適化
- バックアップ機能
- 通知機能（Slack、メール等）
- データ検証機能

### カスタマイズポイント
- 同期頻度
- 出力フォルダ構造
- コミットメッセージ形式
- エラー通知方法
- ファイル命名規則

## 保守性

### コード品質
- 関数の単一責任原則
- エラーハンドリングの統一
- ログ出力の標準化
- 設定の外部化

### テスト可能性
- 個別関数の単体テスト
- モック化可能な設計
- エラーケースの網羅
- ログ出力の検証
