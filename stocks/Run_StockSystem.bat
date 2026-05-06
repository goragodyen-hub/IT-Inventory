@echo off
title StockSupport Server
echo Starting StockSupport System...

:: สั่งเปิดบราวเซอร์ไปที่หน้าเว็บ (รอ 2 วินาทีเพื่อให้เซิร์ฟเวอร์พร้อม)
start "" http://localhost:8000

:: รัน Python Server
python -m http.server 8000
