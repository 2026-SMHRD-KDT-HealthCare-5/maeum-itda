import { apiClient } from '../../../shared/api'
import { roleFromApi, type MyProfile } from '../model'

export async function fetchMyProfile(): Promise<MyProfile> {
  const { data } = await apiClient.users.usersControllerGetMyProfile()
  return {
    userId: data.userId,
    loginId: data.loginId,
    name: data.name,
    phone: data.phone,
    role: roleFromApi(data.role),
  }
}
