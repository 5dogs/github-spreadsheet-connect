# GitHub連携スクリプト 設定例

このファイルは、GitHub連携スクリプトを動作させるために必要なスクリプトプロパティの設定例です。

## 設定手順

1. Google Apps Scriptエディタで「プロジェクトの設定」を開く
2. 「スクリプトプロパティ」タブを選択
3. 以下のプロパティを追加

## 必須プロパティ

### GITHUB_TOKEN
GitHubのPersonal Access Token（必須）
```
プロパティ: GITHUB_TOKEN
値: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### GITHUB_OWNER
GitHubの組織名またはユーザー名（必須）
```
プロパティ: GITHUB_OWNER
値: HatenaBase
```

### GITHUB_REPO
GitHubのリポジトリ名（必須）
```
プロパティ: GITHUB_REPO
値: kintone-dx-projects
```

### GITHUB_PATH
スプレッドシートブックを格納したいファイルへのパス（必須）
```
プロパティ: GITHUB_PATH
値: Litpla/docs/LiTPLA様：要件定義書
```

## オプションプロパティ

### COMMITTER_NAME
GitHubコミット時の作者名（オプション）
```
プロパティ: COMMITTER_NAME
値: GAS Auto Sync
```

### COMMITTER_EMAIL
GitHubコミット時のメールアドレス（オプション）
```
プロパティ: COMMITTER_EMAIL
値: gas-auto-sync@example.com
```

## 設定例（実際の値）

```
GITHUB_TOKEN = ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER = HatenaBase
GITHUB_REPO = kintone-dx-projects
GITHUB_PATH = Litpla/docs/LiTPLA様：要件定義書
COMMITTER_NAME = GAS Auto Sync
COMMITTER_EMAIL = gas-auto-sync@example.com
```

## 注意事項

- `GITHUB_TOKEN`は必須です。設定しないとスクリプトが動作しません
- `GITHUB_PATH`は、リポジトリ内の実際に存在するパスを指定してください
- パスに日本語や特殊文字が含まれる場合は、URLエンコードが必要な場合があります
- トークンは定期的に更新することをお勧めします

## トラブルシューティング

### よくあるエラー

1. **「GitHubトークンが設定されていません」**
   - `GITHUB_TOKEN`プロパティが設定されているか確認

2. **「接続テスト失敗」**
   - トークンの権限が適切か確認
   - リポジトリへのアクセス権限があるか確認

3. **「ファイル情報の取得に失敗」**
   - `GITHUB_PATH`が正しいパスか確認
   - リポジトリ内に該当フォルダが存在するか確認
