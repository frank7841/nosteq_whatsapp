import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TemplateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_name', length: 255, unique: true })
  templateName: string;

  @Column({ length: 10, default: 'en' })
  language: string;

  @Column({ length: 50, nullable: true })
  category: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'json', nullable: true })
  variables: any;

  @Column({
    type: 'enum',
    enum: TemplateStatus,
    default: TemplateStatus.ACTIVE,
  })
  status: TemplateStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}