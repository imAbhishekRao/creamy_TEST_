// let items = document
//     .querySelector(".header__inline-menu")
//     .querySelectorAll("details");
// for (const item of items) {
//     item.addEventListener("mouseover", () => {
//         item.setAttribute("open", true);
//         item.querySelector("ul").addEventListener("mouseleave", () => {
//             item.removeAttribute("open");
//         });
//         item.addEventListener("mouseleave", () => {
//             item.removeAttribute("open");
//         });
//     });
// }

let items = document.querySelector(".header__inline-menu").querySelectorAll("details");

for (const item of items) {
  let closeTimeout;

  item.addEventListener("mouseover", () => {
    clearTimeout(closeTimeout); // cancel closing if mouse comes back
    item.setAttribute("open", true);
  });

  item.addEventListener("mouseleave", () => {
    closeTimeout = setTimeout(() => {
      item.removeAttribute("open");
    }, 300); // delay in ms (300ms = 0.3s)
  });

  const ul = item.querySelector("ul");
  if (ul) {
    ul.addEventListener("mouseleave", () => {
      closeTimeout = setTimeout(() => {
        item.removeAttribute("open");
      }, 300);
    });

    ul.addEventListener("mouseover", () => {
      clearTimeout(closeTimeout);
    });
  }
}
