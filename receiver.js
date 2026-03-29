(function () {
  const NAMESPACE = "urn:x-cast:com.example.quikkplay.receiver";
  const TYPE_SYNC_REQUEST = "SYNC_REQUEST";
  const TYPE_SET_SUBTITLE = "SET_SUBTITLE";
  const TYPE_STATE_SYNC = "STATE_SYNC";
  const TYPE_RECEIVER_LOG = "RECEIVER_LOG";
  const RECEIVER_LOG_TAG = "quikkplay_receiver";
  const statusElement = document.getElementById("receiver-status");
  const titleElement = document.getElementById("receiver-title");
  const detailElement = document.getElementById("receiver-detail");
  const kickerElement = document.getElementById("receiver-kicker");

  const context = cast.framework.CastReceiverContext.getInstance();
  const playerManager = context.getPlayerManager();
  const textTracksManager = playerManager.getTextTracksManager();
  const debugLogger = cast.debug?.CastDebugLogger?.getInstance?.() || null;

  const syncState = {
    currentMediaId: null,
    activeSubtitleAssetId: null,
    queueIndex: null,
    queueSize: null,
    playbackState: "IDLE",
  };

  if (debugLogger) {
    debugLogger.setEnabled(true);
    debugLogger.loggerLevelByEvents = {
      "cast.framework.events.category.CORE": cast.framework.LoggerLevel.INFO,
      "cast.framework.events.category.PLAYER": cast.framework.LoggerLevel.DEBUG,
    };
  }

  function serializeLogDetails(details) {
    if (details == null) {
      return null;
    }
    if (typeof details === "string") {
      return details;
    }
    try {
      return JSON.stringify(details);
    } catch (error) {
      return String(details);
    }
  }

  function emitReceiverLog(level, message, details = null) {
    const normalizedLevel = ["debug", "info", "warn", "error"].includes(level) ? level : "info";
    const serializedDetails = serializeLogDetails(details);
    const debugMessage = serializedDetails ? `${message} ${serializedDetails}` : message;

    if (debugLogger) {
      switch (normalizedLevel) {
        case "debug":
          debugLogger.debug(RECEIVER_LOG_TAG, debugMessage);
          break;
        case "warn":
          debugLogger.warn(RECEIVER_LOG_TAG, debugMessage);
          break;
        case "error":
          debugLogger.error(RECEIVER_LOG_TAG, debugMessage);
          break;
        default:
          debugLogger.info(RECEIVER_LOG_TAG, debugMessage);
          break;
      }
    }

    const consoleMethod =
      normalizedLevel === "debug"
        ? "log"
        : normalizedLevel;
    if (serializedDetails) {
      console[consoleMethod]("[QuikkPlayReceiver]", message, serializedDetails);
    } else {
      console[consoleMethod]("[QuikkPlayReceiver]", message);
    }

    try {
      context.sendCustomMessage(NAMESPACE, undefined, {
        type: TYPE_RECEIVER_LOG,
        level: normalizedLevel.toUpperCase(),
        tag: RECEIVER_LOG_TAG,
        message,
        details: serializedDetails,
      });
    } catch (error) {
      console.warn("[QuikkPlayReceiver]", "Failed to send receiver log", error);
    }
  }

  function setStatus(text) {
    if (statusElement) {
      statusElement.textContent = text;
    }
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  function updateScreenState() {
    const mediaInfo = playerManager.getMediaInformation();
    const mediaTitle = mediaInfo?.metadata?.title || null;
    const playbackState = syncState.playbackState || "IDLE";
    const hasMedia = Boolean(mediaInfo || syncState.currentMediaId);

    let bodyState = "is-idle";
    let badgeStatus = "Ready";
    let kicker = "Receiver Ready";
    let title = "Waiting for playback";
    let detail = "Open QuikkPlay on your phone, choose this Cast device, and start a video, audio track, or image.";

    if (playbackState === "LOADING" || playbackState === "BUFFERING") {
      bodyState = "is-loading";
      badgeStatus = "Loading";
      kicker = "Preparing Playback";
      title = mediaTitle || "Loading media";
      detail = hasMedia
        ? "QuikkPlay has connected. The receiver is fetching and preparing the selected media."
        : "Waiting for QuikkPlay to send media details.";
    } else if (playbackState === "PLAYING") {
      bodyState = "is-playing";
      badgeStatus = "Playing";
      kicker = "Now Playing";
      title = mediaTitle || "Playing on QuikkPlay";
      detail = "Playback is active on this Cast device.";
    } else if (playbackState === "PAUSED") {
      bodyState = "is-idle";
      badgeStatus = "Paused";
      kicker = "Playback Paused";
      title = mediaTitle || "Paused on QuikkPlay";
      detail = "Playback is paused. Resume from QuikkPlay to continue on this screen.";
    } else if (hasMedia) {
      bodyState = "is-loading";
      badgeStatus = "Loading";
      kicker = "Preparing Playback";
      title = mediaTitle || "Preparing media";
      detail = "The receiver has media details and is waiting for playback to start.";
    }

    document.body.classList.remove("is-idle", "is-loading", "is-playing");
    document.body.classList.add(bodyState);
    setStatus(badgeStatus);
    setText(kickerElement, kicker);
    setText(titleElement, title);
    setText(detailElement, detail);
  }

  function getMediaTracks(media) {
    return media?.tracks || media?.mediaTracks || [];
  }

  function findTrackBySubtitleAssetId(subtitleAssetId, media = playerManager.getMediaInformation()) {
    if (!subtitleAssetId) {
      return null;
    }
    return getMediaTracks(media).find((track) => {
      const customData = track?.customData || {};
      return customData.subtitleAssetId === subtitleAssetId;
    }) || null;
  }

  function syncActiveSubtitleFromTracks() {
    const activeTrackIds = textTracksManager.getActiveIds() || [];
    const tracks = getMediaTracks(playerManager.getMediaInformation());
    const activeTrack = tracks.find((track) => activeTrackIds.includes(track.trackId)) || null;
    syncState.activeSubtitleAssetId = activeTrack?.customData?.subtitleAssetId || null;
  }

  function broadcastState() {
    syncActiveSubtitleFromTracks();
    const message = {
      type: TYPE_STATE_SYNC,
      playbackState: syncState.playbackState,
      currentMediaId: syncState.currentMediaId,
      activeSubtitleAssetId: syncState.activeSubtitleAssetId,
      currentTimeMs: Math.max(0, Math.round(playerManager.getCurrentTimeSec() * 1000)),
      queueIndex: syncState.queueIndex,
      queueSize: syncState.queueSize,
    };
    context.sendCustomMessage(NAMESPACE, undefined, message);
  }

  function applySubtitleSelection(subtitleAssetId) {
    const matchingTrack = findTrackBySubtitleAssetId(subtitleAssetId);
    textTracksManager.setActiveByIds(matchingTrack ? [matchingTrack.trackId] : []);
    syncActiveSubtitleFromTracks();
    broadcastState();
  }

  context.addCustomMessageListener(NAMESPACE, (event) => {
    const message = event?.data || {};
    emitReceiverLog("debug", "custom_message_received", { type: message.type || "UNKNOWN" });
    switch (message.type) {
      case TYPE_SYNC_REQUEST:
        broadcastState();
        break;
      case TYPE_SET_SUBTITLE:
        applySubtitleSelection(message.subtitleAssetId || null);
        break;
      default:
        break;
    }
  });

  playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD,
    (loadRequestData) => {
      try {
        const customData = loadRequestData?.media?.customData || {};
        const media = customData.media || {};
        syncState.currentMediaId = media.mediaId || loadRequestData?.media?.entity || loadRequestData?.media?.contentId || null;
        syncState.queueIndex = loadRequestData?.queueData?.startIndex ?? syncState.queueIndex;
        syncState.queueSize = loadRequestData?.queueData?.items?.length ?? syncState.queueSize;
        syncState.playbackState = "LOADING";
        updateScreenState();
        emitReceiverLog("info", "load_intercepted", {
          currentMediaId: syncState.currentMediaId,
          contentId: loadRequestData?.media?.contentId || null,
          contentUrl: loadRequestData?.media?.contentUrl || null,
          contentType: loadRequestData?.media?.contentType || null,
          queueIndex: syncState.queueIndex,
          queueSize: syncState.queueSize,
        });

        const defaultSubtitleAssetId = customData.defaultSubtitleAssetId || null;
        if ((loadRequestData.activeTrackIds == null || loadRequestData.activeTrackIds.length === 0) && defaultSubtitleAssetId) {
          const matchingTrack = findTrackBySubtitleAssetId(defaultSubtitleAssetId, loadRequestData?.media);
          if (matchingTrack) {
            loadRequestData.activeTrackIds = [matchingTrack.trackId];
          }
        }
        return loadRequestData;
      } catch (error) {
        emitReceiverLog("error", "load_interceptor_failed", {
          message: error?.message || String(error),
          stack: error?.stack || null,
        });
        throw error;
      }
    }
  );

  [
    cast.framework.events.EventType.PLAYER_LOADING,
    cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
    cast.framework.events.EventType.IS_PLAYING_CHANGED,
    cast.framework.events.EventType.MEDIA_FINISHED,
    cast.framework.events.EventType.TIME_UPDATE,
    cast.framework.events.EventType.ACTIVE_TRACK_IDS_CHANGED,
    cast.framework.events.EventType.QUEUE_STATUS_CHANGED,
  ].forEach((eventType) => {
    playerManager.addEventListener(eventType, () => {
      syncState.currentMediaId = playerManager.getMediaInformation()?.customData?.media?.mediaId || syncState.currentMediaId;
      syncState.playbackState =
        eventType === cast.framework.events.EventType.PLAYER_LOADING
          ? "LOADING"
          : playerManager.getPlayerState() || "IDLE";
      const queueManager = playerManager.getQueueManager?.();
      if (queueManager) {
        syncState.queueIndex = queueManager.getCurrentItemIndex?.() ?? syncState.queueIndex;
        syncState.queueSize = queueManager.getItems?.().length ?? syncState.queueSize;
      }
      emitReceiverLog("debug", "player_event", {
        eventType,
        playerState: syncState.playbackState,
        currentMediaId: syncState.currentMediaId,
        queueIndex: syncState.queueIndex,
        queueSize: syncState.queueSize,
      });
      updateScreenState();
      if (eventType !== cast.framework.events.EventType.TIME_UPDATE) {
        broadcastState();
      }
    });
  });

  window.addEventListener("error", (event) => {
    emitReceiverLog("error", "window_error", {
      message: event.message,
      fileName: event.filename,
      lineNumber: event.lineno,
      columnNumber: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    emitReceiverLog("error", "unhandled_rejection", {
      reason: serializeLogDetails(event.reason),
    });
  });

  updateScreenState();
  emitReceiverLog("info", "receiver_initialized");

  context.start({
    disableIdleTimeout: true,
    skipPlayersLoad: false,
  });
})();
