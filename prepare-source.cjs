// Prepare the original game locally before applying the localization patch.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = __dirname;
const required = {
  'app.js': '22f346ad13e14f505d463e8b106895f0b4217dc68616b02714dbd165bfc83479',
  'index.html': 'b34c668917defb0a909f50e72940b22a1b74b88d6001cd4b180650d7cd3fa376',
};
const audio = ['ask', 'got'].flatMap(kind => [1, 2, 3, 4].map(n => `voices/en-${kind}${n}.mp3`));
const originalFiles = Object.keys(required);
const files = [...originalFiles, ...audio];
const exists = file => fs.existsSync(file);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const complete = folder => originalFiles.every(name => exists(path.join(folder, name)));

function runPowerShell(script, options = {}) {
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-STA', '-Command', script], {
    encoding: 'utf8', windowsHide: true, ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'PowerShell could not complete the operation.');
  return result.stdout.trim();
}

function selectArchive() {
  if (process.platform !== 'win32') return '';
  console.log('Please select the original cayuocnguyen.zip in the file picker.');
  return runPowerShell(`
    $ErrorActionPreference = 'Stop'
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = 'Select original cayuocnguyen.zip'
    $dialog.Filter = 'ZIP archive (*.zip)|*.zip'
    $dialog.InitialDirectory = [Environment]::GetFolderPath('UserProfile') + '\\Downloads'
    $dialog.CheckFileExists = $true
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.FileName }
    $dialog.Dispose()
  `);
}

function extractArchive(archive, destination) {
  fs.mkdirSync(path.join(destination, 'voices'), { recursive: true });
  if (process.platform === 'win32') {
    // Extract only named resources; never unpack unrelated archive entries.
    runPowerShell(`
      $ErrorActionPreference = 'Stop'
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $zip = [System.IO.Compression.ZipFile]::OpenRead($env:WISHING_TREE_ARCHIVE)
      try {
        $names = @('app.js','index.html','voices/en-ask1.mp3','voices/en-ask2.mp3','voices/en-ask3.mp3','voices/en-ask4.mp3','voices/en-got1.mp3','voices/en-got2.mp3','voices/en-got3.mp3','voices/en-got4.mp3')
        foreach ($name in $names) {
          $entry = $zip.GetEntry($name)
          if ($null -ne $entry) {
            $target = Join-Path $env:WISHING_TREE_STAGE ($name.Replace('/', '\\'))
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false)
          }
        }
      } finally { $zip.Dispose() }
    `, { env: { ...process.env, WISHING_TREE_ARCHIVE: archive, WISHING_TREE_STAGE: destination } });
  } else {
    const result = spawnSync('unzip', ['-q', archive, ...files, '-d', destination], { encoding: 'utf8' });
    if (result.error) throw result.error;
    if (![0, 11].includes(result.status)) throw new Error(result.stderr.trim() || 'ZIP extraction failed.');
  }
}

function installFrom(source) {
  const isDirectory = fs.statSync(source).isDirectory();
  const staging = isDirectory ? source : fs.mkdtempSync(path.join(os.tmpdir(), 'wishing-tree-'));
  try {
    if (!isDirectory) extractArchive(source, staging);
    // The localization targets one specific source version. Validate both files before copying.
    for (const name of originalFiles) {
      const file = path.join(staging, name);
      if (!exists(file) || hash(file) !== required[name]) {
        throw new Error('This source does not match the original cayuocnguyen.zip supplied for the patch.');
      }
      const target = path.join(root, name);
      if (exists(target) && hash(target) !== required[name]) {
        throw new Error(`Existing ${name} differs from the original. Use a fresh patch folder to preserve your changes.`);
      }
    }
    for (const name of files) {
      const file = path.join(staging, name);
      const target = path.join(root, name);
      if (!exists(file) || exists(target)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
    }
  } finally {
    if (!isDirectory) fs.rmSync(staging, { recursive: true, force: true });
  }
}

function main() {
  if (complete(root)) {
    console.log('Original game files found.');
    return;
  }
  const explicit = (process.argv[2] || '').trim();
  const parent = path.dirname(root);
  const home = os.homedir();
  const candidates = explicit ? [path.resolve(explicit)] : [
    path.join(root, 'cayuocnguyen.zip'),
    path.join(parent, 'cayuocnguyen.zip'),
    path.join(root, 'cayuocnguyen'),
    path.join(parent, 'cayuocnguyen'),
    path.join(home, 'Downloads', 'cayuocnguyen.zip'),
    path.join(home, 'Desktop', 'cayuocnguyen.zip'),
  ];
  for (const source of candidates) {
    if (!exists(source)) continue;
    try {
      console.log(`Preparing original game from ${source}`);
      installFrom(source);
      console.log('Original game files installed.');
      return;
    } catch (error) {
      console.error(error.message);
      if (explicit) throw error;
    }
  }
  if (!explicit) {
    const selected = selectArchive();
    if (selected) {
      installFrom(selected);
      console.log('Original game files installed.');
      return;
    }
  }
  throw new Error('Original game not found. Put cayuocnguyen.zip beside dev.bat, or run dev.bat with the ZIP path.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
