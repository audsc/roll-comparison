import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Participant } from '../participants/participants.entity';

export enum SessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum CloseReason {
  MAX_REACHED = 'max_reached',
  MANUAL = 'manual',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  label: string;

  @Column({ type: 'timestamptz', name: 'window_start' })
  windowStart: Date;

  @Column({ type: 'timestamptz', name: 'window_end' })
  windowEnd: Date;

  @Column({ nullable: true, name: 'max_participants', type: 'int' })
  maxParticipants: number | null;

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.OPEN })
  status: SessionStatus;

  @Column({
    type: 'enum',
    enum: CloseReason,
    nullable: true,
    name: 'close_reason',
  })
  closeReason: CloseReason | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Participant, (p) => p.session, { eager: false })
  participants: Participant[];
}
