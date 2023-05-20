(async function () {
  let token = null;

  function isDriveFolder(bookmark) {
    return !!bookmark.url.match(
      /drive\.google\.com\/drive(\/u\/\d+)?\/folders\//
    );
  }

  async function syncBookmarkFolder({ bookmarkFolder, driveFolderId }) {
    // Get list of files in folder
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/files?q="' +
        driveFolderId +
        '"+in+parents&fields=files(id,name,mimeType)',
      {
        headers: new Headers({
          Authorization: "Bearer " + token,
        }),
      }
    );
    const data = await res.json();
    let files = data.files;

    // Sync existing bookmarks in folder
    const bookmarks = await browser.bookmarks.getChildren(bookmarkFolder.id);
    bookmarks.map(async (bookmark) => {
      if (bookmark.type === "folder") {
        const folderId = (await dbGetFolder(bookmark.id)).folderId;

        if (!files.find((file) => file.id === folderId)) {
          await browser.bookmarks.removeTree(bookmark.id);
          return await dbDeleteFolder(bookmark.id);
        }

        bookmark.title = files.find((file) => file.id === folderId).name;
        files = files.filter((file) => file.id !== folderId);
        return await syncBookmarkFolder({
          bookmarkFolder: bookmark,
          driveFolderId: folderId,
        });
      }

      const fileId = bookmark.url.split("/").pop();
      if (!files.find((file) => file.id === fileId)) {
        await browser.bookmarks.remove(bookmark.id);
      }

      bookmark.title = files.find((file) => file.id === fileId).name;
      files = files.filter((file) => file.id !== fileId);
    });

    // Add missing bookmarks in folder
    files.map(async (file) => {
      if (file.mimeType === "application/vnd.google-apps.folder") {
        return createBookmarkFolder({
          parentBookmarkId: bookmarkFolder.id,
          name: file.name,
          driveFolderId: file.id,
        });
      }

      await browser.bookmarks.create({
        parentId: bookmarkFolder.id,
        title: file.name,
        url: "https://drive.google.com/file/d/" + file.id,
      });
    });
  }

  // Replace bookmark with Google Drive folder
  async function createBookmarkFolder({
    parentBookmarkId,
    name,
    driveFolderId,
  }) {
    const bookmarkFolder = await browser.bookmarks.create({
      parentId: parentBookmarkId,
      title: name,
      type: "folder",
    });
    await dbCreateFolder({
      bookmarkId: bookmarkFolder.id,
      folderId: driveFolderId,
    });

    await syncBookmarkFolder({ bookmarkFolder, driveFolderId });
  }

  // Sync a bookmark with Google Drive
  async function sync(bookmarkId) {
    token = (await browser.storage.local.get("token")).token;
    if (typeof token !== "string") {
      token = await oauthLogin();
    }

    const bookmark = (await browser.bookmarks.get(bookmarkId))[0];
    const title = bookmark.title;

    if (bookmark.type === "folder") {
      // Bookmark is an already synced folder
      return await syncBookmarkFolder({
        bookmarkFolder: bookmark,
        driveFolderId: (await dbGetFolder(bookmark.id)).folderId,
      });
    }

    await Promise.all([
      createBookmarkFolder({
        parentBookmarkId: bookmark.parentId,
        name: title,
        driveFolderId: bookmark.url.split("/").pop(),
      }),
      browser.bookmarks.remove(bookmark.id),
    ]);
  }

  // Add context menu item
  browser.contextMenus.create(
    {
      id: "drive-bookmarks-sync",
      title: browser.i18n.getMessage("contextMenuSyncAction"),
      contexts: ["bookmark"],
      enabled: false,
    },
    async function () {
      browser.contextMenus.onShown.addListener(async function (info) {
        if (!info.contexts.includes("bookmark") || !info.bookmarkId) return;

        let bookmark = (await browser.bookmarks.get(info.bookmarkId))[0];

        if (bookmark.type === "folder") {
          let syncedBookmark = await dbGetFolder(bookmark.id);
          console.log(syncedBookmark);

          await browser.contextMenus.update("drive-bookmarks-sync", {
            enabled: !!syncedBookmark,
            title: !!syncedBookmark
              ? browser.i18n.getMessage("contextMenuReSyncAction")
              : browser.i18n.getMessage("contextMenuSyncAction"),
          });
          return await browser.contextMenus.refresh();
        }

        await browser.contextMenus.update("drive-bookmarks-sync", {
          enabled: isDriveFolder(bookmark),
          title: browser.i18n.getMessage("contextMenuSyncAction"),
        });
        await browser.contextMenus.refresh();
      });

      browser.contextMenus.onClicked.addListener(async function (info) {
        if (info.menuItemId === "drive-bookmarks-sync") {
          await sync(info.bookmarkId);
        }
      });
    }
  );
})();
