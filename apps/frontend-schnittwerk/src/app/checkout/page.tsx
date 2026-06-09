'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Truck,
  CreditCard,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Store,
  Info,
  User,
  Shield,
  Lock,
  LogIn,
  UserPlus,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/cart-context';
import { useAuth } from '@/lib/auth/context';
import { CartItem } from '@/components/shop/cart-item';
import { CartSummary } from '@/components/shop/cart-summary';
import { createOrder } from '@/lib/actions/orders';
import { toast } from 'sonner';
import { type ShippingMethodType } from '@/lib/domain/order/types';

// ============================================
// TYPES
// ============================================

type CheckoutStep = 'cart' | 'shipping' | 'payment';
type PaymentMethodType = 'online' | 'pay_at_venue';

interface ShippingFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  street2: string;
  zip: string;
  city: string;
  country: string;
  notes: string;
}

interface LocalShippingOption {
  type: ShippingMethodType;
  name: string;
  priceCents: number;
  description: string;
  estimatedDays?: number;
  available?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const STEPS: { id: CheckoutStep; label: string; icon: React.ElementType }[] = [
  { id: 'cart', label: 'Warenkorb', icon: ShoppingBag },
  { id: 'shipping', label: 'Versand', icon: Truck },
  { id: 'payment', label: 'Zahlung', icon: CreditCard },
];

const SALON_ID = process.env.NEXT_PUBLIC_SALON_ID || '550e8400-e29b-41d4-a716-446655440001';

// ============================================
// CHECKOUT PAGE
// ============================================

export default function CheckoutPage() {
  const router = useRouter();
  const {
    cart,
    isEmpty,
    isDigitalOnly,
    formatPrice,
    clear,
    selectShipping,
  } = useCart();
  const { user, profile, isLoading: isAuthLoading, isAuthenticated, signIn } = useAuth();

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('cart');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodType>('standard');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('online');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Guest checkout state
  const [checkoutMode, setCheckoutMode] = useState<'undecided' | 'guest' | 'login'>('undecided');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);

  const [formData, setFormData] = useState<ShippingFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street: '',
    street2: '',
    zip: '',
    city: '',
    country: 'Schweiz',
    notes: '',
  });

  // Shipping config state (loaded from API)
  const [shippingConfig, setShippingConfig] = useState({
    standardShippingCents: 900,
    freeShippingThresholdCents: 5000,
    enableFreeShipping: true,
    expressEnabled: true,
    expressShippingCents: 1490,
    expressEstimatedDays: '1-2',
    standardEstimatedDays: '3-5',
    pickupEnabled: true,
  });
  const [loadedShippingOptions, setLoadedShippingOptions] = useState<LocalShippingOption[]>([]);

  // Load shipping config from API
  useEffect(() => {
    async function loadShippingConfig() {
      try {
        const response = await fetch('/api/shop/config');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            if (data.data.shipping) {
              setShippingConfig(data.data.shipping);
            }
            if (data.data.shippingOptions) {
              setLoadedShippingOptions(data.data.shippingOptions);
            }
          }
        }
      } catch (error) {
        console.error('Error loading shipping config:', error);
      }
    }
    loadShippingConfig();
  }, []);

  // Set checkout mode based on auth status
  useEffect(() => {
    if (!isAuthLoading) {
      if (isAuthenticated) {
        setCheckoutMode('guest'); // User is logged in, proceed directly
      }
    }
  }, [isAuthLoading, isAuthenticated]);

  // Pre-fill form data when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const email = profile?.email || user.email || '';
      const firstName = profile?.first_name || user.user_metadata?.first_name || '';
      const lastName = profile?.last_name || user.user_metadata?.last_name || '';
      const phone = profile?.phone || user.phone || '';

      setFormData((prev) => ({
        ...prev,
        firstName: firstName || prev.firstName,
        lastName: lastName || prev.lastName,
        email: email || prev.email,
        phone: phone || prev.phone,
      }));
    }
  }, [isAuthenticated, user, profile]);

  // Pre-fill address from customer record
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    async function loadCustomerAddress() {
      try {
        const response = await fetch(`/api/shop/customer-address`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setFormData((prev) => ({
              ...prev,
              street: data.data.street || prev.street,
              street2: data.data.street2 || prev.street2,
              zip: data.data.zip || prev.zip,
              city: data.data.city || prev.city,
              country: data.data.country || prev.country,
            }));
          }
        }
      } catch (error) {
        console.error('Error loading customer address:', error);
      }
    }
    loadCustomerAddress();
  }, [isAuthenticated, user]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Bitte E-Mail und Passwort eingeben');
      return;
    }
    setIsLoggingIn(true);
    try {
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) {
        toast.error('Anmeldung fehlgeschlagen', {
          description: error.message || 'Bitte überprüfen Sie Ihre Zugangsdaten',
        });
      } else {
        toast.success('Erfolgreich angemeldet');
        setCheckoutMode('guest');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Get current step index
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  // Check if cart qualifies for free shipping
  const freeShipping = shippingConfig.enableFreeShipping &&
    cart.totals.subtotalCents >= shippingConfig.freeShippingThresholdCents;

  // Get shipping options (from API or fallback)
  const shippingOptions: LocalShippingOption[] = useMemo(() => (
    isDigitalOnly
      ? [{ type: 'none', name: 'Kein Versand', priceCents: 0, description: 'Digitale Produkte' }]
      : loadedShippingOptions.length > 0
        ? loadedShippingOptions.map((opt) => ({
            ...opt,
            priceCents: freeShipping && opt.type !== 'pickup' ? 0 : opt.priceCents,
          }))
        : [
            {
              type: 'standard',
              name: 'Standardversand',
              priceCents: freeShipping ? 0 : shippingConfig.standardShippingCents,
              description: `${shippingConfig.standardEstimatedDays} Werktage`,
            },
            ...(shippingConfig.expressEnabled ? [{
              type: 'express' as ShippingMethodType,
              name: 'Expressversand',
              priceCents: freeShipping ? 0 : shippingConfig.expressShippingCents,
              description: `${shippingConfig.expressEstimatedDays} Werktage`,
            }] : []),
            ...(shippingConfig.pickupEnabled ? [{
              type: 'pickup' as ShippingMethodType,
              name: 'Abholung im Salon',
              priceCents: 0,
              description: 'Kostenlos',
            }] : []),
          ]
  ), [freeShipping, isDigitalOnly, loadedShippingOptions, shippingConfig]);

  // Redirect to shop if cart is empty
  useEffect(() => {
    if (isEmpty && currentStep !== 'cart') {
      router.push('/shop');
    }
  }, [isEmpty, currentStep, router]);

  // Skip shipping step for digital-only orders
  useEffect(() => {
    if (isDigitalOnly && currentStep === 'shipping') {
      setShippingMethod('none');
      setCurrentStep('payment');
    }
  }, [isDigitalOnly, currentStep]);

  useEffect(() => {
    if (shippingOptions.length === 0) return;
    if (!shippingOptions.some((option) => option.type === shippingMethod)) {
      setShippingMethod(shippingOptions[0].type);
    }
  }, [shippingOptions, shippingMethod]);

  useEffect(() => {
    const selectedOption = shippingOptions.find((option) => option.type === shippingMethod);
    if (!selectedOption) return;

    selectShipping({
      id: selectedOption.type,
      name: selectedOption.name,
      description: selectedOption.description,
      priceCents: selectedOption.priceCents,
      estimatedDays: selectedOption.estimatedDays
        ? String(selectedOption.estimatedDays)
        : selectedOption.description,
      isDefault: selectedOption.type === 'standard',
    });
  }, [selectShipping, shippingMethod, shippingOptions]);

  // Reset payment method when shipping method changes from pickup
  useEffect(() => {
    if (shippingMethod !== 'pickup' && paymentMethod === 'pay_at_venue') {
      setPaymentMethod('online');
    }
  }, [shippingMethod, paymentMethod]);

  // Handlers
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleNextStep = () => {
    // Check if user has decided on checkout mode (cart step)
    if (currentStep === 'cart' && !isAuthenticated) {
      if (checkoutMode === 'undecided') {
        toast.error('Bitte wählen Sie eine Bestellmethode');
        return;
      }
      if (checkoutMode === 'login') {
        toast.error('Bitte melden Sie sich an oder bestellen Sie als Gast');
        return;
      }
    }

    if (currentStep === 'shipping') {
      if (!validateShippingForm()) {
        return;
      }
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handlePrevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const validateShippingForm = (): boolean => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('Bitte geben Sie Ihren Vor- und Nachnamen ein');
      return false;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error('Bitte geben Sie eine gültige E-Mail-Adresse ein');
      return false;
    }
    if (shippingMethod !== 'pickup' && shippingMethod !== 'none') {
      if (!formData.street.trim()) {
        toast.error('Bitte geben Sie Ihre Strasse ein');
        return false;
      }
      if (!formData.zip.trim()) {
        toast.error('Bitte geben Sie Ihre PLZ ein');
        return false;
      }
      if (!formData.city.trim()) {
        toast.error('Bitte geben Sie Ihren Ort ein');
        return false;
      }
    }
    return true;
  };

  const handleSubmitOrder = async () => {
    if (isSubmitting) return;
    if (!validateShippingForm()) return;

    setIsSubmitting(true);

    try {
      const result = await createOrder({
        salonId: SALON_ID,
        profileId: isAuthenticated && user ? user.id : undefined,
        customerEmail: formData.email,
        customerName: `${formData.firstName} ${formData.lastName}`,
        customerPhone: formData.phone || undefined,
        shippingMethod: shippingMethod,
        shippingAddress:
          shippingMethod !== 'pickup' && shippingMethod !== 'none'
            ? {
                name: `${formData.firstName} ${formData.lastName}`,
                street: formData.street,
                street2: formData.street2 || undefined,
                zip: formData.zip,
                city: formData.city,
                country: formData.country,
              }
            : undefined,
        customerNotes: formData.notes || undefined,
        source: 'online',
        paymentMethod: paymentMethod === 'pay_at_venue' ? 'pay_at_venue' : 'stripe_card',
        initiatePayment: paymentMethod === 'online',
        saveCustomerData: isAuthenticated && saveAddress,
        items: cart.items.map((item) => ({
          itemType: item.type === 'voucher' ? 'voucher' : 'product',
          productId: item.productId,
          variantId: item.variantId,
          itemName: item.name,
          itemDescription: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          voucherType: item.type === 'voucher' ? 'value' : undefined,
          recipientEmail: item.recipientEmail,
          recipientName: item.recipientName,
          personalMessage: item.personalMessage,
        })),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.checkoutUrl) {
        clear();
        window.location.href = result.checkoutUrl;
      } else if (result.order) {
        clear();
        router.push(`/checkout/success?order=${result.order.orderNumber}`);
      }
    } catch (error) {
      console.error('Order submission error:', error);
      toast.error('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render empty cart
  if (isEmpty && currentStep === 'cart') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center text-center max-w-md">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Ihr Warenkorb ist leer</h1>
          <p className="text-muted-foreground mb-6">
            Entdecken Sie unsere Produkte und Gutscheine.
          </p>
          <Button asChild>
            <Link href="/shop">
              Zum Shop
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 md:py-12">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center justify-center gap-2 md:gap-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;
              const isClickable = isCompleted && !isSubmitting;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => isClickable && setCurrentStep(step.id)}
                    disabled={!isClickable}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : isCompleted
                        ? 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20'
                        : 'bg-background text-muted-foreground border'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline text-sm font-medium">{step.label}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-8 md:w-12 h-0.5 mx-1 md:mx-2 ${
                        index < currentStepIndex ? 'bg-primary' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Step 1: Cart Review */}
            {currentStep === 'cart' && (
              <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    Warenkorb überprüfen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="divide-y">
                    {cart.items.map((item) => (
                      <CartItem key={item.id} item={item} />
                    ))}
                  </div>

                </CardContent>
              </Card>

              {/* Login / Guest Checkout Option */}
              {!isAuthLoading && !isAuthenticated && checkoutMode === 'undecided' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Wie möchten Sie bestellen?
                    </CardTitle>
                    <CardDescription>
                      Melden Sie sich an oder bestellen Sie als Gast
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <button
                        onClick={() => setCheckoutMode('login')}
                        className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <LogIn className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium">Anmelden</p>
                          <p className="text-sm text-muted-foreground">
                            Mit bestehendem Konto
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => setCheckoutMode('guest')}
                        className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium">Als Gast bestellen</p>
                          <p className="text-sm text-muted-foreground">
                            Ohne Registrierung
                          </p>
                        </div>
                      </button>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Mit einem Konto können Sie Ihre Bestellungen verfolgen und Ihre Daten speichern.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Login Form */}
              {!isAuthLoading && !isAuthenticated && checkoutMode === 'login' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LogIn className="h-5 w-5" />
                      Anmelden
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="loginEmail">E-Mail</Label>
                        <Input
                          id="loginEmail"
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="ihre@email.ch"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loginPassword">Passwort</Label>
                        <Input
                          id="loginPassword"
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCheckoutMode('undecided')}
                          className="flex-1"
                        >
                          Zurück
                        </Button>
                        <Button type="submit" className="flex-1" disabled={isLoggingIn}>
                          {isLoggingIn ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Anmelden...
                            </>
                          ) : (
                            'Anmelden'
                          )}
                        </Button>
                      </div>
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setCheckoutMode('guest')}
                          className="text-sm text-primary hover:underline"
                        >
                          Lieber als Gast bestellen
                        </button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Logged in user info */}
              {isAuthenticated && profile && (
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {profile.first_name} {profile.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{profile.email}</p>
                      </div>
                      <Badge variant="secondary">Angemeldet</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
              </>
            )}

            {/* Step 2: Shipping */}
            {currentStep === 'shipping' && (
              <>
                {/* Contact Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Kontaktdaten
                    </CardTitle>
                    {isAuthenticated && (
                      <CardDescription>
                        Ihre gespeicherten Daten wurden vorausgefüllt
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Vorname *</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          placeholder="Vorname"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Nachname *</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          placeholder="Nachname"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">E-Mail *</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="ihre@email.ch"
                          required
                          disabled={isAuthenticated}
                          className={isAuthenticated ? 'bg-muted' : ''}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefon (optional)</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+41 xx xxx xx xx"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping Method */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Versandart
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={shippingMethod}
                      onValueChange={(val) => setShippingMethod(val as ShippingMethodType)}
                      className="space-y-3"
                    >
                      {shippingOptions.map((option) => (
                        <label
                          key={option.type}
                          className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                            shippingMethod === option.type
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem
                              value={option.type}
                              id={option.type}
                              className={shippingMethod === option.type ? 'border-green-600 text-green-600' : ''}
                            />
                            <div>
                              <span className="font-medium">{option.name}</span>
                              <p className="text-sm text-muted-foreground">
                                {option.description}
                              </p>
                            </div>
                          </div>
                          <span className={`font-medium ${option.priceCents === 0 ? 'text-green-600' : ''}`}>
                            {option.priceCents === 0 ? 'Kostenlos' : formatPrice(option.priceCents)}
                          </span>
                        </label>
                      ))}
                    </RadioGroup>

                    {freeShipping && (
                      <p className="mt-3 text-sm text-green-600">
                        Kostenloser Versand ab CHF 50 Bestellwert!
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Shipping Address */}
                {shippingMethod !== 'pickup' && shippingMethod !== 'none' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Lieferadresse</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="street">Strasse und Hausnummer *</Label>
                        <Input
                          id="street"
                          name="street"
                          value={formData.street}
                          onChange={handleInputChange}
                          placeholder="Musterstrasse 123"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="street2">Adresszusatz (optional)</Label>
                        <Input
                          id="street2"
                          name="street2"
                          value={formData.street2}
                          onChange={handleInputChange}
                          placeholder="c/o, Apartment, etc."
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="zip">PLZ *</Label>
                          <Input
                            id="zip"
                            name="zip"
                            value={formData.zip}
                            onChange={handleInputChange}
                            placeholder="9000"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">Ort *</Label>
                          <Input
                            id="city"
                            name="city"
                            value={formData.city}
                            onChange={handleInputChange}
                            placeholder="St. Gallen"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Land</Label>
                        <Input
                          id="country"
                          name="country"
                          value={formData.country}
                          className="bg-muted"
                          disabled
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Bemerkungen (optional)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Besondere Anweisungen zur Lieferung..."
                      rows={3}
                    />
                  </CardContent>
                </Card>
              </>
            )}

            {/* Step 3: Payment */}
            {currentStep === 'payment' && (
              <>
                {/* Contact Info for Digital Orders */}
                {isDigitalOnly && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Kontaktdaten
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">Vorname *</Label>
                          <Input
                            id="firstName"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            placeholder="Vorname"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Nachname *</Label>
                          <Input
                            id="lastName"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            placeholder="Nachname"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="email">E-Mail *</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder="ihre@email.ch"
                            required
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Der Gutschein wird an diese E-Mail-Adresse gesendet.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Method Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Zahlungsmethode
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(val) => setPaymentMethod(val as PaymentMethodType)}
                      className="space-y-3"
                    >
                      {/* Online Payment */}
                      <label
                        className={`flex items-start justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                          paymentMethod === 'online'
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <RadioGroupItem value="online" id="online" className="mt-1" />
                          <div>
                            <span className="font-medium">Online bezahlen</span>
                            <p className="text-sm text-muted-foreground mt-1">
                              Kreditkarte, TWINT oder weitere Zahlungsmethoden
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">Visa</Badge>
                              <Badge variant="secondary" className="text-xs">Mastercard</Badge>
                              <Badge variant="secondary" className="text-xs">TWINT</Badge>
                            </div>
                          </div>
                        </div>
                      </label>

                      {/* Pay at Venue - only for pickup orders */}
                      {shippingMethod === 'pickup' && (
                        <label
                          className={`flex items-start justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                            paymentMethod === 'pay_at_venue'
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <RadioGroupItem value="pay_at_venue" id="pay_at_venue" className="mt-1" />
                            <div>
                              <span className="font-medium flex items-center gap-2">
                                <Store className="h-4 w-4" />
                                Im Salon bezahlen
                              </span>
                              <p className="text-sm text-muted-foreground mt-1">
                                Bezahlen Sie bei der Abholung im Salon
                              </p>
                            </div>
                          </div>
                        </label>
                      )}
                    </RadioGroup>

                    {paymentMethod === 'pay_at_venue' && (
                      <div className="mt-4 flex items-start gap-3 rounded-lg bg-blue-50 dark:bg-blue-950 p-4">
                        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          Ihre Bestellung wird reserviert. Bitte holen Sie diese innerhalb von 7 Tagen ab.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Order Confirmation Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Bestellung bestätigen</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Summary Info */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span>{formData.firstName && formData.lastName ? `${formData.firstName} ${formData.lastName}` : '–'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">E-Mail</span>
                        <span>{formData.email || '–'}</span>
                      </div>
                      {shippingMethod !== 'none' && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Versand</span>
                          <span>
                            {shippingMethod === 'pickup'
                              ? 'Abholung im Salon'
                              : `${formData.street}, ${formData.zip} ${formData.city}`}
                          </span>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <p className="text-sm text-muted-foreground">
                      {paymentMethod === 'online' ? (
                        <>
                          Durch Klicken auf &quot;Jetzt bezahlen&quot; werden Sie zu unserem
                          sicheren Zahlungsanbieter weitergeleitet.
                        </>
                      ) : (
                        <>
                          Durch Klicken auf &quot;Bestellung aufgeben&quot; reservieren wir
                          Ihre Bestellung. Sie bezahlen bei Abholung.
                        </>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              {currentStepIndex > 0 ? (
                <Button variant="outline" onClick={handlePrevStep} disabled={isSubmitting}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Zurück
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/shop">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Weiter einkaufen
                  </Link>
                </Button>
              )}

              {currentStep === 'payment' ? (
                <Button onClick={handleSubmitOrder} disabled={isSubmitting} size="lg">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Wird verarbeitet...
                    </>
                  ) : paymentMethod === 'online' ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Jetzt bezahlen
                    </>
                  ) : (
                    <>
                      Bestellung aufgeben
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleNextStep}>
                  Weiter
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Bestellübersicht</CardTitle>
                </CardHeader>
                <CardContent>
                  <CartSummary compact showShipping={currentStep !== 'cart'} />
                </CardContent>
              </Card>

              {/* Trust Badges */}
              <div className="text-center space-y-3 py-4">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  Sichere Zahlung
                </div>
                <div className="flex justify-center gap-2">
                  <Badge variant="outline" className="text-xs">Visa</Badge>
                  <Badge variant="outline" className="text-xs">Mastercard</Badge>
                  <Badge variant="outline" className="text-xs">TWINT</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  SSL-verschlüsselte Verbindung
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
