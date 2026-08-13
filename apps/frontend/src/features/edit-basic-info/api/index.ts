import { apiClient } from '../../../shared/api'
import { roleFromApi, type MyProfile } from '../../../entities/user'

export async function updateMyProfile(data: { name?: string; phone?: string }): Promise<MyProfile> {
  const { data: updated } = await apiClient.users.usersControllerUpdateMyProfile(data)
  return {
    userId: updated.userId,
    loginId: updated.loginId,
    name: updated.name,
    phone: updated.phone,
    role: roleFromApi(updated.role),
  }
}
