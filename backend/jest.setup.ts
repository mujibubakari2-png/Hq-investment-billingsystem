// @ts-ignore
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://enterprisedb:Muu%4066487125@127.0.0.1:5432/testdb';
process.env.JWT_SECRET ||= 'test_secret_must_be_32_chars_long!!';
process.env.JWT_ACCESS_SECRET ||= 'test_access_secret_must_be_at_least_32_chars_long!!!';
process.env.JWT_REFRESH_SECRET ||= 'test_refresh_secret_must_be_at_least_32_chars_and_different_from_access_secret!!!';
process.env.FIELD_ENCRYPTION_KEY ||= 'test_field_encryption_key_64_chars_0123456789abcdef0123456789abcdef';
process.env.CRON_SECRET ||= 'test_cron_secret_16chars';
