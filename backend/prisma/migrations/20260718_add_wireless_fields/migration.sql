-- Migration: 20260718_add_wireless_fields
-- Purpose: Add optional wireless/AP fields to the routers table
-- These fields back the optional AP/wireless configuration used by
-- the Router script generator and admin UI.

ALTER TABLE "routers"
  ADD COLUMN IF NOT EXISTS "wlanEnabled" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "wlan1Ssid" TEXT,
  ADD COLUMN IF NOT EXISTS "wlan2Ssid" TEXT,
  ADD COLUMN IF NOT EXISTS "wlanSecurity" TEXT DEFAULT 'wpa2-psk',
  ADD COLUMN IF NOT EXISTS "wlanPassphrase" TEXT,
  ADD COLUMN IF NOT EXISTS "wlan1TxChain" TEXT DEFAULT '0,1',
  ADD COLUMN IF NOT EXISTS "wlan1RxChain" TEXT DEFAULT '0,1',
  ADD COLUMN IF NOT EXISTS "wlan2TxChain" TEXT DEFAULT '0',
  ADD COLUMN IF NOT EXISTS "wlan2RxChain" TEXT DEFAULT '0';

-- Note: wlanPassphrase is stored encrypted via application helpers when
-- reading/writing router configuration (see encryptRouterFields/decryptRouterFields).
