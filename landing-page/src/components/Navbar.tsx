"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-white shadow-sm z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-bold text-primary">
              HQInvestment <span className="text-secondary">Billing</span>
            </Link>
          </div>
          <div className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-700 hover:text-primary transition-colors">Home</Link>
            <Link href="#features" className="text-gray-700 hover:text-primary transition-colors">Features</Link>
            <Link href="#pricing" className="text-gray-700 hover:text-primary transition-colors">Pricing</Link>
            <Link href="#contact" className="text-gray-700 hover:text-primary transition-colors">Contact</Link>
            <Link 
              href={`${process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL}/login`}
              className="text-gray-700 hover:text-primary transition-colors font-medium border-l pl-8 ml-8"
            >
              Login
            </Link>
          </div>
          <div className="hidden md:block">
            <Link 
              href={`${process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL}/register`}
              className="bg-primary text-white px-6 py-2 rounded-full font-medium hover:bg-accent transition-all inline-block"
            >
              Start Free Trial
            </Link>
          </div>
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-700">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t p-4 space-y-4">
          <Link href="/" onClick={() => setIsOpen(false)} className="block text-gray-700 font-medium">Home</Link>
          <Link href="#features" onClick={() => setIsOpen(false)} className="block text-gray-700 font-medium">Features</Link>
          <Link href="#pricing" onClick={() => setIsOpen(false)} className="block text-gray-700 font-medium">Pricing</Link>
          <Link href="#contact" onClick={() => setIsOpen(false)} className="block text-gray-700 font-medium">Contact</Link>
          <Link 
            href={`${process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL}/login`}
            onClick={() => setIsOpen(false)} 
            className="block text-gray-700 font-medium border-t pt-4 mt-4"
          >
            Login
          </Link>
          <Link 
            href={`${process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL}/register`}
            onClick={() => setIsOpen(false)} 
            className="block w-full bg-primary text-white px-6 py-2 rounded-lg font-medium text-center"
          >
            Start Free Trial
          </Link>
        </div>
      )}
    </nav>
  );
}
