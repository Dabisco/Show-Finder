document.addEventListener("DOMContentLoaded", () => {
  let navButtons = document.querySelectorAll(".nav-links .btn");
  let showPageBtns = document.querySelectorAll(".container-small.props span");
  let favBtn = document.querySelector(".fav-btn");
  let favBtnId = favBtn?.dataset.favoriteId;

  let activeBtn = JSON.parse(localStorage.getItem("activeBtn")) || {
    active: null,
  };

  function activeBtnUpdater(index) {
    activeBtn.active = index;
    localStorage.setItem("activeBtn", JSON.stringify(activeBtn));
  }

  function activeBtnSwitcher() {
    //restore previously active button on reload
    if (activeBtn.active !== null && navButtons[activeBtn.active]) {
      navButtons[activeBtn.active].classList.add("active-btn");
    }

    navButtons.forEach((button, index) => {
      button.addEventListener("click", (e) => {
        navButtons.forEach((button) => {
          button.classList.remove("active-btn");
        });
        //Add the active-btn class
        e.currentTarget.classList.add("active-btn");
        activeBtnUpdater(index);
      });
    });
  }

  activeBtnSwitcher();

  // function activeBtnRemover() {
  //   navButtons.forEach((button) => {
  //     button.classList.remove("active-btn");
  //   });
  // }

  function activePropRemover() {
    showPageBtns.forEach((button) => {
      button.classList.remove("active-prop");
      //   button.classList.add("no-display");
    });
    // let props = document.querySelectorAll(".container-small")
  }

  function displayRemover() {
    let props = document.querySelectorAll(".container-small");

    props.forEach((prop) => {
      if (
        !prop.classList.contains("genre") &&
        !prop.classList.contains("props")
      ) {
        if (!prop.classList.contains("no-display")) {
          prop.classList.add("no-display");
        }
      }
    });
  }

  function showPageBtnSwitcher() {
    showPageBtns.forEach((button) => {
      button.addEventListener("click", function () {
        displayRemover();
        activePropRemover();
        button.classList.add("active-prop");
        let activePropDistinctClass =
          this.textContent.charAt(0).toLowerCase() + this.textContent.slice(1);
        let activeProp = document.querySelector(
          `.container-small.${activePropDistinctClass}`
        );
        activeProp.classList.remove("no-display");
      });
    });
  }

  let favorites = JSON.parse(localStorage.getItem("favorites")) || {};

  function favBtnStateUpdater(id, isFavorited) {
    favorites[id] = isFavorited;
    localStorage.setItem("favorites", JSON.stringify(favorites)); //persist update
  }

  function favoriteBtnSwitcher() {
    //check for favorite status of show
    for (let Id of Object.keys(favorites)) {
      if (favBtnId === Id) {
        if (favorites[Id] === true) {
          favBtn.classList.remove("unfavorited");
          favBtn.classList.add("favorited");
          favBtn.querySelector("span").textContent = `Favorited`;
        } else {
          favBtn.classList.remove("favorited");
          favBtn.classList.add("unfavorited");
          favBtn.querySelector("span").textContent = `Add to favorites`;
        }
      }
    }

    favBtn?.addEventListener("click", (e) => {
      if (e.currentTarget.classList.contains("favorited")) {
        e.currentTarget.classList.remove("favorited");
        e.currentTarget.classList.add("unfavorited");
        favBtn.querySelector("span").textContent = `Add to favorites`;
        favBtnStateUpdater(favBtnId, false);
        collectAllFavorites();
        sendCurrentFavorites();
      } else {
        e.currentTarget.classList.remove("unfavorited");
        e.currentTarget.classList.add("favorited");
        favBtn.querySelector("span").textContent = `Favorited`;
        favBtnStateUpdater(favBtnId, true);
        collectAllFavorites();
        sendCurrentFavorites();
      }
    });
  }

  let currentFavorites = [];

  function collectAllFavorites() {
    currentFavorites = [];
    for (let favorite in favorites) {
      if (favorites[favorite] === true) {
        currentFavorites.push(favorite);
      }
    }
  }

  function sendCurrentFavorites() {
    fetch("/favorites-builder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ currentFavorites }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        console.log("Sent favorites successfully!");
      })
      .catch((error) => {
        console.log(`Error: ${error.message}`);
      });
  }

  favoriteBtnSwitcher();
  showPageBtnSwitcher();
});
