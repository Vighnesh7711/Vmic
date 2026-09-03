import {
  VMICParticipant,
} from "./participant";


export interface ParticipantJoinedEvent {
  participant:
    VMICParticipant;
}


export interface ParticipantLeftEvent {
  participantId:
    string;
}
