import { Column, DbEntity, Entity, Id, Length, Nullable } from "../entity"

@Entity('User')
export class RawUser {
  @Nullable()
  @Id()
  @Column(Number)
  public id: number

  @Nullable()
  @Column(Number)
  public role: number

  @Length()
  @Column(String)
  public nickname: string

  @Length(1, 100)
  @Column(String)
  public password: string
}

@Entity('Customer')
export class RawCustomer {
  @Nullable()
  @Id()
  @Column(Number)
  public user_id: number

  @Nullable()
  @Column(Number)
  public points: number

  @Nullable()
  @Column(Number)
  public deposit: number

  @Nullable()
  @Column(Number)
  public ban_time: number
}

@Entity('Maintainer')
export class RawMaintainer {
  @Nullable()
  @Id()
  @Column(Number)
  public user_id: number

  @Length(1, 10)
  @Column(String)
  public name: string

  @Length()
  @Column(String)
  public phone: string

  @Nullable()
  @Column(Number)
  public handle_count: number
}

@Entity('Manager')
export class RawManager {
  @Nullable()
  @Id()
  @Column(Number)
  public user_id: number

  @Length(1, 10)
  @Column(String)
  public name: string

  @Length()
  @Column(String)
  public phone: string
}