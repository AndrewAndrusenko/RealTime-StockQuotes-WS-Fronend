@echo off
rd /s /q c:\!Development\!Projects\Prod-Server-3A\dist\public\apps\rtq

mkdir c:\!Development\!Projects\Prod-Server-3A\dist\public\apps\rtq

xcopy /s /y c:\!Development\!Projects\Real-Time-Quotes-Frontend\dist\browser c:\!Development\!Projects\Prod-Server-3A\dist\public\apps\rtq
