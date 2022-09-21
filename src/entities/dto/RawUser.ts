import { Column, Entity, Foreign, Id, Length, Nullable, Readonly, Restriction } from "../entity"

@Entity('User')
export class RawUser {
  @Nullable
  @Id
  @Column(Number)
  public id: number

  @Nullable
  @Column(Number)
  public role: number

  @Length()
  @Column(String)
  public nickname: string

  @Length(1, 100)
  @Column(String, 100)
  public password: string

  @Length(1, 50)
  @Nullable
  @Restriction('imageKey')
  @Column(String)
  public avatar_key: string
}

@Entity('Customer')
export class RawCustomer {
  @Nullable
  @Id
  @Foreign(RawUser, 'id')
  @Column(Number)
  public user_id: number

  @Column(Number)
  public points: number

  @Restriction('price')
  @Column(String)
  public deposit: string

  @Restriction('positive')
  @Column(Number)
  public mileage_total: number

  @Column(Date)
  public ban_time: Date
}

@Entity('Maintainer')
export class RawMaintainer {
  @Nullable
  @Id
  @Foreign(RawUser, 'id')
  @Column(Number)
  public user_id: number

  @Length(1, 10)
  @Column(String)
  public name: string

  @Length()
  @Column(String)
  public phone: string

  @Readonly
  @Column(Number)
  public handle_count: number
}

@Entity('Manager')
export class RawManager {
  @Nullable
  @Id
  @Foreign(RawUser, 'id')
  @Column(Number)
  public user_id: number

  @Length(1, 10)
  @Column(String)
  public name: string

  @Length()
  @Column(String)
  public phone: string
}