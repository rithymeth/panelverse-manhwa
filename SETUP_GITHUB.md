# Publish this project to a GitHub repository

GitHub repository creation is not supported by the connected GitHub actions in this ChatGPT session. Create an **empty** repository named `panelverse-manhwa` at https://github.com/new (choose public or private; do not check the GitHub initial README/license/gitignore options).

After you have created it, either ask ChatGPT to push this project to your new repository using the GitHub connector, or use these commands in a terminal at the project root:

```bash
git init -b main
git add .
git commit -m "Initial Panelverse manhwa website"
git remote add origin https://github.com/rithymeth/panelverse-manhwa.git
git push -u origin main
```

If a remote named `origin` already exists, use `git remote set-url origin https://github.com/rithymeth/panelverse-manhwa.git` instead. Authentication uses your GitHub credentials or Git credential manager; never commit a token into files.

After pushing, connect the repository to the hosting provider that supports **persistent storage**, such as a container host with a persistent volume. Do not use Vercel ephemeral filesystem with local SQLite/uploads.
