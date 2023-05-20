(function () {
  const dbName = "syncedBookmarks";
  let db;

  const request = indexedDB.open(dbName, 2);
  request.onerror = function (event) {
    console.log("Error opening database", event);
  };

  request.onsuccess = function (event) {
    db = event.target.result;
    console.log("Database opened successfully");
  };

  request.onupgradeneeded = function (event) {
    const db = event.target.result;
    const objectStore = db.createObjectStore("bookmarks", {
      keyPath: "bookmarkId",
    });
    objectStore.createIndex("folderId", "folderId", { unique: false });
  };

  window.dbCreateFolder = async function ({ bookmarkId, folderId }) {
    const transaction = db.transaction(["bookmarks"], "readwrite");
    const objectStore = transaction.objectStore("bookmarks");
    const request = objectStore.add({ bookmarkId, folderId });
    request.onsuccess = function (event) {
      console.log("Folder created");
    };
    request.onerror = function (event) {
      console.log("Error creating folder", event);
    };
  };

  window.dbGetFolder = async function (bookmarkId) {
    const transaction = db.transaction(["bookmarks"]);
    const objectStore = transaction.objectStore("bookmarks");
    const request = objectStore.get(bookmarkId);
    return await new Promise((resolve, reject) => {
      request.onsuccess = function (event) {
        resolve(request.result);
      };
      request.onerror = function (event) {
        reject(event);
      };
    });
  };

  window.dbDeleteFolder = async function (bookmarkId) {
    const transaction = db.transaction(["bookmarks"], "readwrite");
    const objectStore = transaction.objectStore("bookmarks");
    const request = objectStore.delete(bookmarkId);
    request.onsuccess = function (event) {
      console.log("Folder deleted");
    };
    request.onerror = function (event) {
      console.log("Error deleting folder", event);
    };
  };
})();
