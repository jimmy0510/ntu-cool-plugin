// ==UserScript==
// @name         台大 SSO 自動登入（NTU COOL plugin）
// @namespace    https://github.com/jimmy0510/ntu-cool-plugin
// @version      1.0.0
// @description  台大 SSO 登入頁的帳密被瀏覽器密碼管理員填好後，自動按「登入」。腳本本身不存、不讀、不傳送任何帳密。
// @match        https://adfs.ntu.edu.tw/adfs/ls/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/jimmy0510/ntu-cool-plugin/main/autologin/ntu-sso-autologin.user.js
// @updateURL    https://raw.githubusercontent.com/jimmy0510/ntu-cool-plugin/main/autologin/ntu-sso-autologin.user.js
// ==/UserScript==

(() => {
  const user = document.getElementById('ContentPlaceHolder1_UsernameTextBox');
  const pass = document.getElementById('ContentPlaceHolder1_PasswordTextBox');
  const btn = document.getElementById('ContentPlaceHolder1_SubmitButton');
  if (!user || !pass || !btn) return;

  // 一分鐘內按過就不再按：密碼錯了會回到這頁，不能一直重送把帳號鎖住。
  const KEY = 'ntuAutoLoginAt';
  if (Date.now() - Number(sessionStorage.getItem(KEY) || 0) < 60_000) return;

  // 瀏覽器自動填入的值在使用者互動前讀不到（value 是空字串），只能用 :autofill 判斷「已填」。
  const filled = (el) => el.value !== '' || el.matches(':autofill') || el.matches(':-webkit-autofill');

  let tries = 0;
  const timer = setInterval(() => {
    if (filled(user) && filled(pass)) {
      clearInterval(timer);
      sessionStorage.setItem(KEY, String(Date.now()));
      btn.click();
    } else if (++tries > 50) {
      clearInterval(timer); // 10 秒內沒被填好（沒存密碼），就交給使用者自己登入
    }
  }, 200);
})();
