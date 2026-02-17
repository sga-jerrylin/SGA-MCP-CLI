import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('credentials')
@Index(['tenantId', 'serverId', 'keyName'], { unique: true })
export class CredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ length: 50 })
  @Index()
  serverId!: string;

  @Column({ length: 100 })
  keyName!: string;

  @Column('bytea')
  encryptedValue!: Buffer;

  @Column('bytea')
  encryptionIv!: Buffer;

  @Column('bytea')
  authTag!: Buffer;

  @Column('int')
  keyVersion!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
