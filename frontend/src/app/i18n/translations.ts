/**
 * UI string dictionary. `en` is the source of truth; `vi` is typed so a
 * missing or extra key fails to compile. Keys are checked at compile time
 * via `TranslationKey` (strictTemplates catches typos in templates too).
 */
const en = {
  // Sidebar + dashboard quick links + the matching page h1s (same strings)
  'menu.dashboard': 'Dashboard',
  'menu.savingsPassbooks': 'Savings Passbooks',
  'menu.landAssets': 'Land Assets',
  'menu.cashAssets': 'Cash Assets',
  'menu.otherAssets': 'Other Assets',
  'menu.currencies': 'Currencies',
  'menu.users': 'Users',
  // Header dropdown, table headers, badges, toggle buttons
  'common.settings': 'Settings',
  'common.changePassword': 'Change Password',
  'common.logout': 'Logout',
  'common.language': 'Language',
  'common.status': 'Status',
  'common.created': 'Created',
  'common.actions': 'Actions',
  'common.active': 'Active',
  'common.inactive': 'Inactive',
  'common.activate': 'Activate',
  'common.deactivate': 'Deactivate',
  // /user-setting page
  'userSetting.subtitle': 'Your account information.',
  'userSetting.phone': 'Phone',
  'userSetting.role': 'Role',
  'userSetting.accountNumber': 'Account number',
  'userSetting.accountLevel': 'Account level',
  'userSetting.joined': 'Joined',
} as const;

const vi: { [K in keyof typeof en]: string } = {
  'menu.dashboard': 'Tổng quan',
  'menu.savingsPassbooks': 'Sổ tiết kiệm',
  'menu.landAssets': 'Đất đai',
  'menu.cashAssets': 'Tiền mặt',
  'menu.otherAssets': 'Tài sản khác',
  'menu.currencies': 'Tiền tệ',
  'menu.users': 'Người dùng',
  'common.settings': 'Cài đặt',
  'common.changePassword': 'Đổi mật khẩu',
  'common.logout': 'Đăng xuất',
  'common.language': 'Ngôn ngữ',
  'common.status': 'Trạng thái',
  'common.created': 'Ngày tạo',
  'common.actions': 'Hoạt động',
  'common.active': 'Hoạt động',
  'common.inactive': 'Tạm ngưng',
  'common.activate': 'Hoạt động',
  'common.deactivate': 'Tạm ngưng',
  'userSetting.subtitle': 'Thông tin tài khoản.',
  'userSetting.phone': 'Điện thoại',
  'userSetting.role': 'Quyền hạn',
  'userSetting.accountNumber': 'Số tài khoản',
  'userSetting.accountLevel': 'Cấp độ',
  'userSetting.joined': 'Ngày tham gia',
};

export const translations = { en, vi } as const;
export type Language = keyof typeof translations; // 'en' | 'vi'
export type TranslationKey = keyof typeof en;
