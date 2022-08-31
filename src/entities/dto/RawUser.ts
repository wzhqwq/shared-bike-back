import { Column, DbEntity, Entity, Length, Nullable } from "../entity"

@Entity('User')
class RawUser {
  @Nullable()
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

export default RawUser