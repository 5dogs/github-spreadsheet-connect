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

## UML図

### 1. クラス図

```mermaid
classDiagram
    class GASScript {
        +getCSVData() String
        +getConfig() Object
        +getExistingFileSHA(url, headers) String
        +updateSpreadsheetToGitHub() Object
        +testGitHubConnection() void
        +setupAutoSync() void
    }
    
    class SpreadsheetService {
        +getActiveSpreadsheet() Spreadsheet
        +getSheetByName(name) Sheet
        +getDataRange() Range
        +getValues() Array
    }
    
    class CSVProcessor {
        +convertToCSV(data) String
        +escapeCSV(cellValue) String
        +base64Encode(csv) String
    }
    
    class GitHubAPI {
        +getFileInfo(url, headers) Object
        +updateFile(url, payload, headers) Object
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
    
    GASScript --> SpreadsheetService
    GASScript --> CSVProcessor
    GASScript --> GitHubAPI
    GASScript --> ConfigManager
    GASScript --> TriggerManager
```

### 2. シーケンス図（メイン同期処理）

```mermaid
sequenceDiagram
    participant User
    participant GAS as GAS Script
    participant SS as Spreadsheet
    participant GH as GitHub API
    participant Props as Script Properties
    
    User->>GAS: updateSpreadsheetToGitHub()
    GAS->>Props: getConfig()
    Props-->>GAS: config object
    
    GAS->>SS: getCSVData()
    SS-->>GAS: CSV data (Base64)
    
    GAS->>GH: getExistingFileSHA()
    alt File exists
        GH-->>GAS: SHA hash
    else File not exists
        GH-->>GAS: null
    end
    
    GAS->>GH: PUT /contents/{path}
    Note over GAS,GH: Commit payload with content
    
    alt Success
        GH-->>GAS: 200/201 + commit info
        GAS-->>User: Success response
    else Error
        GH-->>GAS: Error code + message
        GAS-->>User: Error thrown
    end
```

### 3. アクティビティ図（CSVデータ処理）

```mermaid
flowchart TD
    A[開始: getCSVData] --> B[シート取得]
    B --> C{シート存在?}
    C -->|No| D[エラー: シートが見つからない]
    C -->|Yes| E[データ範囲取得]
    E --> F[データ値を取得]
    F --> G[CSV変換開始]
    G --> H[各行を処理]
    H --> I[各セルを処理]
    I --> J{セル値チェック}
    J -->|null/undefined| K[空文字列に変換]
    J -->|有効な値| L[文字列に変換]
    K --> M[CSVエスケープ処理]
    L --> M
    M --> N{特殊文字含む?}
    N -->|Yes| O[ダブルクォートで囲む]
    N -->|No| P[そのまま使用]
    O --> Q[カンマ区切りで結合]
    P --> Q
    Q --> R{全セル処理完了?}
    R -->|No| I
    R -->|Yes| S[改行で行結合]
    S --> T[Base64エンコード]
    T --> U[完了: Base64文字列返却]
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
    CSV取得 -->|成功| GitHub接続
    GitHub接続 --> 既存ファイル確認
    既存ファイル確認 -->|存在| SHA取得
    既存ファイル確認 -->|不存在| 新規作成
    SHA取得 --> コミットペイロード作成
    新規作成 --> コミットペイロード作成
    コミットペイロード作成 --> API送信
    API送信 -->|成功| 成功終了
    API送信 -->|失敗| エラー終了
    成功終了 --> [*]
    エラー終了 --> [*]
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
    SS --> Sheet
    Props --> Token
    GH --> Repo
```

## データフロー

### 入力データ
- Google Spreadsheet のシートデータ
- スクリプトプロパティ（GitHub Token、コミッター情報）

### 処理フロー
1. **データ抽出**: Spreadsheet → CSV形式
2. **データ変換**: CSV → Base64エンコード
3. **API通信**: GitHub Contents API
4. **結果保存**: コミット情報の記録

### 出力データ
- GitHubリポジトリのCSVファイル
- コミット履歴
- 実行ログ

## 設定項目

### 必須設定
- `GITHUB_TOKEN`: GitHub Personal Access Token
- `owner`: GitHubユーザー名
- `repo`: リポジトリ名
- `path`: ファイルパス

### オプション設定
- `COMMITTER_NAME`: コミッター名
- `COMMITTER_EMAIL`: コミッターメール

## エラーハンドリング

### 主要エラーケース
1. シートが見つからない
2. GitHubトークンが設定されていない
3. GitHub API通信エラー
4. ファイル更新失敗

### エラー対応
- 適切なエラーメッセージの表示
- ログ出力
- 例外の再スロー

## セキュリティ考慮事項

### 認証
- GitHub Personal Access Token の使用
- スクリプトプロパティでの機密情報管理

### アクセス制御
- リポジトリへの書き込み権限
- トークンの有効期限管理

## パフォーマンス最適化

### 実行頻度
- デフォルト: 1時間ごと
- カスタマイズ可能

### データ処理
- 効率的なCSV変換
- Base64エンコードの最適化

## 拡張性

### 追加可能な機能
- 複数シート対応
- 差分更新
- バックアップ機能
- 通知機能

### カスタマイズポイント
- 同期頻度
- ファイル形式
- コミットメッセージ
- エラー通知
