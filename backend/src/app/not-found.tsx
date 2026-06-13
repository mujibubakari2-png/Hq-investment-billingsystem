"use client";
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>404 - Not Found</h2>
      <p>Could not find requested resource</p>
      <Link href="/">
        Return Home
      </Link>
    </div>
  );
}
