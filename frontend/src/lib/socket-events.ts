export const SOCKET_EVENTS = {
  JOIN_ROOM: "join_room",
  ROOM_JOINED: "room_joined",

  PARTICIPANT_JOINED:
    "participant_joined",

  PARTICIPANT_LEFT:
    "participant_left",

  PARTICIPANT_UPDATED:
    "participant_updated",

  REQUEST_FLOOR:
    "request_floor",

  GRANT_FLOOR:
    "grant_floor",

  DENY_FLOOR:
    "deny_floor",

  RELEASE_FLOOR:
    "release_floor",

  FLOOR_UPDATED:
    "floor_updated",

  PUSH_TO_TALK:
    "push_to_talk",

  PUSH_TO_TALK_UPDATED:
    "push_to_talk_updated",

  MUTE_PARTICIPANT:
    "mute_participant",

  UNMUTE_PARTICIPANT:
    "unmute_participant",

  SET_PARTICIPANT_VOLUME:
    "set_participant_volume",

  MASTER_VOLUME_CHANGED:
    "master_volume_changed",

  AUDIO_CONTROL_UPDATED:
    "audio_control_updated",

  LATENCY_PING:
    "latency_ping",

  LATENCY_PONG:
    "latency_pong",

  WEBRTC_OFFER:
    "webrtc_offer",

  WEBRTC_ANSWER:
    "webrtc_answer",

  ICE_CANDIDATE:
    "ice_candidate",

  SESSION_STARTED:
    "session_started",

  SESSION_ENDED:
    "session_ended",

  ERROR: "error",
} as const;
