@echo off
echo Starting Local Server without Python...
powershell -ExecutionPolicy Bypass -Command "Write-Host 'Server starting at http://localhost:8000'; $p=8000; $w=New-Object Net.HttpListener; $w.Prefixes.Add('http://localhost:'+$p+'/'); $w.Start(); while($w.IsListening){ $c=$w.GetContext(); $r=$c.Response; $path=$c.Request.Url.LocalPath; if($path -eq '/') { $path='/index.html' }; $f=Join-Path $pwd $path.TrimStart('/'); if(Test-Path $f -PathType Leaf){ $b=[IO.File]::ReadAllBytes($f); $r.ContentLength64=$b.Length; $r.OutputStream.Write($b,0,$b.Length) } else { $r.StatusCode=404 }; $r.Close() }"
pause
