
/* =========================================================
   الشريط السفلي - مطعم الغنام
   ملف مستقل حتى لا يستبدل وظائف script.js الأصلي
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const homePage = document.getElementById("homePage");
    const branchPage = document.getElementById("branchPage");
    const branchesSection = document.getElementById("branchesSection")
        || document.querySelector(".branches-home");
    const backButton = document.getElementById("backToBranches");
    const menu = document.getElementById("menu");
    const footer = document.getElementById("aboutRestaurant")
        || document.querySelector(".footer");

    const searchPanel = document.getElementById("bottomSearchPanel");
    const searchInput = document.getElementById("bottomSearchInput");
    const searchMessage = document.getElementById("bottomSearchMessage");
    const closeSearchButton = document.getElementById("closeBottomSearch");

    const navButtons = document.querySelectorAll("[data-nav]");

    if (!searchPanel || !searchInput || !searchMessage) {
        console.warn("لم يتم العثور على عناصر لوحة البحث.");
        return;
    }

    let searchIsOpen = false;

    function isBranchOpen() {
        return branchPage && !branchPage.hidden;
    }

    function setActiveButton(name) {
        navButtons.forEach(function (item) {
            const isActive = item.dataset.nav === name;

            item.classList.toggle("active", isActive);

            if (isActive) {
                item.setAttribute("aria-current", "page");
            } else {
                item.removeAttribute("aria-current");
            }
        });
    }

    function restoreProducts() {
        if (!menu) return;

        menu.querySelectorAll(".product-card").forEach(function (card) {
            card.hidden = false;
        });
    }

    function closeSearch(restoreResults = true) {
        searchPanel.hidden = true;
        searchIsOpen = false;

        if (restoreResults) {
            restoreProducts();
        }
    }

    function openSearch() {
        searchPanel.hidden = false;
        searchIsOpen = true;

        if (isBranchOpen()) {
            searchInput.placeholder = "اكتب اسم الوجبة...";
            searchMessage.textContent =
                "اكتب اسم الوجبة لتصفية قائمة الطعام.";

            filterProducts();
            searchInput.focus();
        } else {
            searchInput.value = "";
            searchInput.placeholder = "اختار فرعًا أولًا";
            searchMessage.textContent =
                "حتى تبحث عن الوجبات، ارجع للرئيسية واختار أحد الفروع.";
        }
    }

    function filterProducts() {
        if (!isBranchOpen() || !menu) {
            searchMessage.textContent =
                "اختار أحد الفروع أولًا حتى تبحث في قائمة الطعام.";
            return;
        }

        const query = searchInput.value
            .trim()
            .toLocaleLowerCase("ar");

        const cards = Array.from(
            menu.querySelectorAll(".product-card")
        );

        if (cards.length === 0) {
            searchMessage.textContent =
                "قائمة الطعام لم تظهر بعد. انتظر تحميل الوجبات ثم جرّب.";
            return;
        }

        let visibleCount = 0;

        cards.forEach(function (card) {
            const cardText = card.textContent
                .toLocaleLowerCase("ar");

            const matches = !query || cardText.includes(query);

            card.hidden = !matches;

            if (matches) {
                visibleCount++;
            }
        });

        if (!query) {
            searchMessage.textContent =
                "عدد الوجبات في هذا الفرع: " + visibleCount;
        } else if (visibleCount === 0) {
            searchMessage.textContent =
                "لم نعثر على وجبة بهذا الاسم. جرّب كلمة أخرى.";
        } else {
            searchMessage.textContent =
                "عدد الوجبات المطابقة: " + visibleCount;
        }
    }

    /* الرئيسية: العودة إلى اختيار الفروع */
    const homeButton = document.querySelector('[data-nav="home"]');

    if (homeButton) {
        homeButton.addEventListener("click", function () {
            closeSearch();
            setActiveButton("home");

            if (isBranchOpen() && backButton) {
                // نستعمل زر الرجوع الأصلي حتى لا نتعارض مع منطق اختيار الفرع.
                backButton.click();
            } else if (homePage) {
                homePage.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }

            // إغلاق لوحة البحث عند الرجوع للرئيسية.
            searchInput.value = "";
        });
    }

    /* البحث: فتح لوحة البحث وتصفية المنتجات */
    const searchButton = document.querySelector('[data-nav="search"]');

    if (searchButton) {
        searchButton.addEventListener("click", function () {
            setActiveButton("search");

            if (searchIsOpen) {
                closeSearch();
            } else {
                openSearch();
            }
        });
    }

    searchInput.addEventListener("input", filterProducts);

    /* إغلاق لوحة البحث */
    if (closeSearchButton) {
        closeSearchButton.addEventListener("click", function () {
            closeSearch();
            searchInput.value = "";
            setActiveButton(isBranchOpen() ? "" : "home");
        });
    }

    /* زر عن المطعم */
    const aboutButton = document.querySelector('[data-nav="about"]');

    if (aboutButton) {
        aboutButton.addEventListener("click", function () {
            closeSearch();
            searchInput.value = "";
            setActiveButton("about");

            if (footer) {
                footer.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        });
    }

    /* المساعدة: إغلاق البحث قبل فتح صفحة المساعدة */
    const helpLink = document.querySelector(
        '.bottom-nav-item[href="support/support.html"]'
    );

    if (helpLink) {
        helpLink.addEventListener("click", function () {
            closeSearch();
        });
    }

    /* إغلاق البحث عند النقر خارج اللوحة وزر البحث */
    document.addEventListener("click", function (event) {
        const clickedInsidePanel = searchPanel.contains(event.target);
        const clickedSearchButton = searchButton
            && searchButton.contains(event.target);

        if (
            searchIsOpen
            && !clickedInsidePanel
            && !clickedSearchButton
        ) {
            closeSearch();
        }
    });

    /* إغلاق البحث بمفتاح Escape */
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeSearch();
            searchInput.value = "";
            setActiveButton(isBranchOpen() ? "" : "home");
        }
    });

    /*
      إذا تغيّرت الصفحة من خلال كود الموقع الأصلي،
      لا نفترض أن البحث مفتوح أو أن المنيو محمّل.
      تتم استعادة النتائج عند إغلاق لوحة البحث.
    */
    const observer = menu
        ? new MutationObserver(function () {
            if (searchIsOpen && isBranchOpen()) {
                filterProducts();
            }
        })
        : null;

    if (observer && menu) {
        observer.observe(menu, {
            childList: true,
            subtree: true
        });
    }
});
