export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-TZ', {
        minimumFractionDigits: 0,
    }).format(amount);
};

export const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const formatPhone = (phone: string): string => {
    if (phone.startsWith('255')) {
        return `+${phone}`;
    }
    return phone;
};

export const generatePassword = (length: number = 8): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

export const generateUsername = (): string => {
    return Math.floor(10000 + Math.random() * 90000).toString();
};
