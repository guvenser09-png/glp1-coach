// Firebase devre dışı — AuthContext AsyncStorage kullanıyor
export async function loginUser(email, password) {
  return { user: { uid: 'mock-uid', email } };
}

export async function registerUser(email, password) {
  return { user: { uid: 'mock-uid-' + Date.now(), email } };
}

export async function logoutUser() {}
