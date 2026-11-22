const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Configuration des mises à jour automatiques via GitHub Releases
autoUpdater.autoDownload = true;

// Événement déclenché quand la mise à jour a fini de se télécharger discrètement
autoUpdater.on('update-downloaded', (info) => {
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Mise à jour disponible',
      message: `La version ${info.version} de My Bread a été téléchargée avec succès.`,
      detail: "L'application va redémarrer pour appliquer la mise à jour.",
      buttons: ['Redémarrer maintenant', 'Plus tard'],
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});

function createWindow() {
  const iconFile = process.platform === 'darwin' ? 'icon.png' : 'icon.ico';
  const win = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'My Bread — Gestion de Boulangerie Artisanale',
    icon: path.join(__dirname, iconFile),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // En développement avec serveur live ou en production avec les fichiers compilés
  if (process.env.ELECTRON_START_URL) {
    win.loadURL(process.env.ELECTRON_START_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/my-bread/browser/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // En production compilée, vérifie automatiquement si une mise à jour existe sur GitHub
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
