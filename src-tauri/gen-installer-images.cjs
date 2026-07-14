// 生成 NSIS 安装程序品牌 BMP(header 150x57 + sidebar 164x314)。
// 用 powershell -EncodedCommand(UTF-16LE base64)绕开 .ps1 文件在中文 Windows 下被按 GBK 解码的坑。
const { execFileSync } = require("child_process");
const path = require("path");

const dir = path.join(__dirname, "icons").replace(/\\/g, "/");

const ps = `
Add-Type -AssemblyName System.Drawing
$dir = "${dir}"
function Fill-Grad($g, $w, $h, $c1, $c2, $vertical) {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $mode = if ($vertical) { [System.Drawing.Drawing2D.LinearGradientMode]::Vertical } else { [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal }
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, $mode
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()
}

$hw = 150; $hh = 57
$h = New-Object System.Drawing.Bitmap $hw, $hh
$hg = [System.Drawing.Graphics]::FromImage($h)
$hg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$hg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
Fill-Grad $hg $hw $hh ([System.Drawing.Color]::FromArgb(26,26,30)) ([System.Drawing.Color]::FromArgb(99,102,241)) $false
$hf = New-Object System.Drawing.Font 'Microsoft YaHei UI', 14, ([System.Drawing.FontStyle]::Bold)
$hfmt = New-Object System.Drawing.StringFormat
$hfmt.Alignment = [System.Drawing.StringAlignment]::Center
$hfmt.LineAlignment = [System.Drawing.StringAlignment]::Center
$hg.DrawString('办了么  DoneYet', $hf, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0,0,$hw,$hh), $hfmt)
$hg.Dispose(); $hf.Dispose()
$h.Save("$dir/installer-header.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

$sw = 164; $sh = 314
$s = New-Object System.Drawing.Bitmap $sw, $sh
$sg = [System.Drawing.Graphics]::FromImage($s)
$sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$sg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
Fill-Grad $sg $sw $sh ([System.Drawing.Color]::FromArgb(26,26,30)) ([System.Drawing.Color]::FromArgb(67,56,202)) $true
$sfmt = New-Object System.Drawing.StringFormat
$sfmt.Alignment = [System.Drawing.StringAlignment]::Center
$accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(165,180,252))
$gray = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(160,160,170))
$silver = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(200,200,208))
$fBig = New-Object System.Drawing.Font 'Microsoft YaHei UI', 30, ([System.Drawing.FontStyle]::Bold)
$fEn = New-Object System.Drawing.Font 'Segoe UI', 16
$fTag = New-Object System.Drawing.Font 'Microsoft YaHei UI', 10
$fSig = New-Object System.Drawing.Font 'Brush Script MT', 16, ([System.Drawing.FontStyle]::Italic)
$sg.DrawString('办了么', $fBig, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0,42,$sw,40), $sfmt)
$sg.DrawString('DoneYet', $fEn, $accent, (New-Object System.Drawing.RectangleF 0,86,$sw,24), $sfmt)
$sg.DrawString('便签 · 待办 · 日历 · 提醒', $fTag, $gray, (New-Object System.Drawing.RectangleF 0,210,$sw,20), $sfmt)
$sg.DrawString('Crafted by BEIZHOU', $fSig, $silver, (New-Object System.Drawing.RectangleF 0,282,$sw,24), $sfmt)
$sg.Dispose(); $fBig.Dispose(); $fEn.Dispose(); $fTag.Dispose(); $fSig.Dispose()
$s.Save("$dir/installer-sidebar.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)

Write-Output "saved header + sidebar bmp"
`;

const b64 = Buffer.from(ps, "utf16le").toString("base64");
try {
  const out = execFileSync("powershell.exe", ["-ExecutionPolicy", "Bypass", "-EncodedCommand", b64], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  console.log(out.trim());
} catch (e) {
  console.error("powershell failed:", e.stderr || e.message);
  process.exit(1);
}
