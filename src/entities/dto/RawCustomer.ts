export type RawCustomer = {
  user_id: number
  points: number
  deposit: number
  ban_time: number
}
export const rawCustomerColumns: (keyof RawCustomer)[] = ['user_id', 'points', 'deposit', 'ban_time']