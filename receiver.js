(function () {
  const TAG = "quikkplay_receiver_min";
  const statusElement = document.getElementById("receiver-status");
  const titleElement = document.getElementById("receiver-title");
  const detailElement = document.getElementById("receiver-detail");
  const kickerElement = document.getElementById("receiver-kicker");

  const context = cast.framework.CastReceiverContext.getInstance();
  const playerManager = context.getPlayerManager();
  const debugLogger = cast.debug?.CastDebugLogger?.getInstance?.() || null;

  if (debugLogger) {
    debugLogger.setEnabled(true);
    debugLogger.loggerLevelByEvents = {
      "cast.framework.events.category.CORE": cast.framework.LoggerLevel.INFO,
      "cast.framework.events.category.PLAYER": cast.framework.LoggerLevel.DEBUG,
    };
  }

  function log(level, message, details) {
    const text = details == null ? message : `${message} ${JSON.stringify(details)}`;
    if (debugLogger) {
      if (level === "error") {
        debugLogger.error(TAG, text);
      } else if (level === "warn") {
        debugLogger.warn(TAG, text);
      } else if (level === "debug") {
        debugLogger.debug(TAG, text);
      } else {
        debugLogger.info(TAG, text);
      }
    }
    const consoleMethod = level === "debug" ? "log" : level;
    if (details == null) {
      console[consoleMethod]("[QuikkPlayReceiverMinimal]", message);
    } else {
      console[consoleMethod]("[QuikkPlayReceiverMinimal]", message, details);
    }
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  function render(state, mediaInfo) {
    const title = mediaInfo?.metadata?.title || "Waiting for playback";
    document.body.classList.remove("is-idle", "is-loading", "is-playing");

    switch (state) {
      case "LOADING":
      case "BUFFERING":
        document.body.classList.add("is-loading");
        setText(statusElement, "Loading");
        setText(kickerElement, "Minimal Receiver");
        setText(titleElement, title);
        setText(detailElement, "Receiver is alive and waiting for the media pipeline to start.");
        break;
      case "PLAYING":
        document.body.classList.add("is-playing");
        setText(statusElement, "Playing");
        setText(kickerElement, "Minimal Receiver");
        setText(titleElement, title);
        setText(detailElement, "Basic CAF playback is active.");
        break;
      case "PAUSED":
        document.body.classList.add("is-idle");
        setText(statusElement, "Paused");
        setText(kickerElement, "Minimal Receiver");
        setText(titleElement, title);
        setText(detailElement, "Playback is paused.");
        break;
      default:
        document.body.classList.add("is-idle");
        setText(statusElement, "Ready");
        setText(kickerElement, "Minimal Receiver");
        setText(titleElement, "Waiting for playback");
        setText(detailElement, "This stripped-down receiver only verifies that CAF can load and play media.");
        break;
    }
  }

  playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD,
    (loadRequestData) => {
      const media = loadRequestData?.media || null;
      log("info", "minimal_load_intercepted", {
        contentId: media?.contentId || null,
        contentUrl: media?.contentUrl || null,
        contentType: media?.contentType || null,
        hasTracks: Array.isArray(media?.tracks) && media.tracks.length > 0,
        hasCustomData: media?.customData != null,
      });
      render("LOADING", media);
      return loadRequestData;
    }
  );

  [
    cast.framework.events.EventType.PLAYER_LOADING,
    cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
    cast.framework.events.EventType.IS_PLAYING_CHANGED,
    cast.framework.events.EventType.MEDIA_FINISHED,
    cast.framework.events.EventType.ERROR,
  ].forEach((eventType) => {
    playerManager.addEventListener(eventType, (event) => {
      const mediaInfo = playerManager.getMediaInformation();
      const playerState = playerManager.getPlayerState() || "IDLE";
      log("info", "minimal_player_event", {
        eventType,
        playerState,
        title: mediaInfo?.metadata?.title || null,
        detailedErrorCode: event?.detailedErrorCode || null,
      });
      render(playerState, mediaInfo);
    });
  });

  window.addEventListener("error", (event) => {
    log("error", "window_error", {
      message: event.message,
      fileName: event.filename,
      lineNumber: event.lineno,
      columnNumber: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    log("error", "unhandled_rejection", {
      reason: String(event.reason),
    });
  });

  render("IDLE", null);
  log("info", "minimal_receiver_initialized");

  context.start({
    disableIdleTimeout: true,
    skipPlayersLoad: false,
  });
})();
