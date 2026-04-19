import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Session } from '../sessions/sessions.entity';

@Entity('participants')
export class Participant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @ManyToOne(() => Session, (s) => s.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({ name: 'whoop_user_id' })
  whoopUserId: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;

  @Column({ name: 'is_creator', default: false })
  isCreator: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
