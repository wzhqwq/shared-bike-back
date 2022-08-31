export default class Result<T> {
  constructor(
    public status: boolean,
    public data?: T,
    public error?: string,
  ) { }
  
  public static success<T>(data: T) {
    return new Result<T>(true, data)
  }

  public static fail(error: string) {
    return new Result<null>(false, undefined, error)
  }
}