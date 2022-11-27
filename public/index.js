const textEle = [
    "GAB-UP App",
    "Have a secure group chat or private chat",
    "Create rooms and share password with your friends",
    "Safe and secure chat"
];

const textChange = document.querySelector(".text-change");

window.addEventListener("DOMContentLoaded", function () {
  setInterval(function () {
    let ran = changeText(textEle);
    textChange.innerHTML = textEle[ran];
  }, 2000);
});

function changeText(textEle) {
  let ran = Math.floor(Math.random() * textEle.length);
  return ran;
}
