'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Truck,
  CreditCard,
  Check,
  ArrowRight,
  ArrowLeft,
  Tag,
  X,
  Loader2,
  Store,
  Info,
  User,
  Shield,
  Lock,
  Sparkles,
  LogIn,
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
  name: string;
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

const SALON_ID = process.env.NEXT_PUBLIC_SALON_ID || '';

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
  } = useCart();
  const { user, profile, isLoading: isAuthLoading, isAuthenticated, signIn } = useAuth();

  const [currentStep, setCurrentStep] = useState<CheckoutStep>('cart');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodType>('standard');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('online');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
  } | null>(null);

  // Guest checkout state
  const [checkoutMode, setCheckoutMode] = useState<'undecided' | 'guest' | 'login'>('undecided');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);

  const [formData, setFormData] = useState<ShippingFormData>({
    name: '',
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
    if (isAuthenticated && profile) {
      setFormData((prev) => ({
        ...prev,
        name: profile.first_name && profile.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : profile.display_name || prev.name,
        email: profile.email || prev.email,
        phone: profile.phone || prev.phone,
      }));
    }
  }, [isAuthenticated, profile]);

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
  const shippingOptions: LocalShippingOption[] = isDigitalOnly
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
        ];

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
    if (currentStep === 'cart') {
      if (!isAuthenticated && checkoutMode === 'undecided') {
        toast.error('Bitte wählen Sie eine Bestellmethode');
        return;
      }
      if (!isAuthenticated && checkoutMode === 'login') {
        toast.error('Bitte melden Sie sich an oder bestellen Sie als Gast');
        return;
      }
    }

    // Validate shipping form before moving to payment
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
    if (!formData.name.trim()) {
      toast.error('Bitte geben Sie Ihren Namen ein');
      return false;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error('Bitte geben Sie eine gueltige E-Mail-Adresse ein');
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
        customerEmail: formData.email,
        customerName: formData.name,
        customerPhone: formData.phone || undefined,
        shippingMethod: shippingMethod,
        shippingAddress:
          shippingMethod !== 'pickup' && shippingMethod !== 'none'
            ? {
                name: formData.name,
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
        profileId: isAuthenticated && user ? user.id : undefined,
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
        // Redirect to Stripe Checkout
        clear();
        window.location.href = result.checkoutUrl;
      } else if (result.order) {
        // Order created without payment (e.g., pay at venue)
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

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;

    // Mock discount validation (replace with actual API call)
    if (discountCode.toUpperCase() === 'WELCOME10') {
      const discount = Math.round(cart.totals.subtotalCents * 0.1);
      setAppliedDiscount({ code: 'WELCOME10', amount: discount });
      toast.success('Gutscheincode angewendet');
    } else {
      toast.error('Ungueltiger Gutscheincode');
    }
    setDiscountCode('');
  };

  // Render empty cart
  if (isEmpty && currentStep === 'cart') {
    return (
      <div className="container max-w-4xl py-16 md:py-24">
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-muted to-muted/30 flex items-center justify-center mb-8">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-3">Ihr Warenkorb ist leer</h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            Entdecken Sie unsere Produkte und Gutscheine und finden Sie das Perfekte fuer sich.
          </p>
          <Button asChild size="lg" className="btn-glow rounded-full px-8">
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
    <div className="container max-w-6xl py-8 md:py-12 animate-fade-in">
      {/* Progress Steps */}
      <div className="mb-10 md:mb-12">
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
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all duration-300 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-glow-sm'
                      : isCompleted
                      ? 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/15'
                      : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  <span className="hidden sm:inline font-medium text-sm">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-10 md:w-16 h-0.5 mx-2 rounded-full transition-colors duration-300 ${
                      index < currentStepIndex ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Step 1: Cart Review */}
          {currentStep === 'cart' && (
            <Card className="card-elegant overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                <CardTitle className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
                  Warenkorb ueberpruefen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-0 divide-y divide-border/50">
                  {cart.items.map((item) => (
                    <CartItem key={item.id} item={item} />
                  ))}
                </div>

                {/* Discount Code */}
                <div className="mt-8 pt-6 border-t border-border/50">
                  <Label className="mb-3 block text-sm font-medium">Gutscheincode</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Code eingeben"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      className="rounded-xl"
                    />
                    <Button onClick={handleApplyDiscount} variant="outline" className="rounded-xl hover:bg-primary/5 hover:border-primary/30">
                      <Tag className="h-4 w-4 mr-2" />
                      Einloesen
                    </Button>
                  </div>
                  {appliedDiscount && (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        {appliedDiscount.code}: -{formatPrice(appliedDiscount.amount)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAppliedDiscount(null)}
                        className="h-8 w-8 p-0 hover:bg-emerald-500/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Login / Guest Checkout Selection */}
                {!isAuthLoading && (
                  <div className="mt-8 pt-6 border-t border-border/50">
                    <Label className="mb-3 block text-sm font-medium">Bestellmethode</Label>

                    {isAuthenticated && user ? (
                      // Already logged in - show user info
                      <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Check className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-green-800 dark:text-green-200">
                              Angemeldet als {profile?.display_name || profile?.email || user.email}
                            </p>
                            <p className="text-sm text-green-600 dark:text-green-400">
                              Ihre Daten werden automatisch ausgefüllt
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="saveAddress"
                            checked={saveAddress}
                            onChange={(e) => setSaveAddress(e.target.checked)}
                            className="rounded border-green-300"
                          />
                          <label htmlFor="saveAddress" className="text-sm text-green-700 dark:text-green-300">
                            Adressdaten für zukünftige Bestellungen speichern
                          </label>
                        </div>
                      </div>
                    ) : (
                      // Not logged in - show login/guest options
                      <div className="space-y-3">
                        {/* Guest Checkout Option */}
                        <button
                          type="button"
                          onClick={() => setCheckoutMode('guest')}
                          className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-300 ${
                            checkoutMode === 'guest'
                              ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                              : 'border-border/50 hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              checkoutMode === 'guest' ? 'bg-green-500/20' : 'bg-muted'
                            }`}>
                              <User className={`h-5 w-5 ${checkoutMode === 'guest' ? 'text-green-600' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                              <p className="font-medium">Als Gast bestellen</p>
                              <p className="text-sm text-muted-foreground">
                                Keine Registrierung erforderlich
                              </p>
                            </div>
                            {checkoutMode === 'guest' && (
                              <Check className="ml-auto h-5 w-5 text-green-600" />
                            )}
                          </div>
                        </button>

                        {/* Login Option */}
                        <button
                          type="button"
                          onClick={() => setCheckoutMode('login')}
                          className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-300 ${
                            checkoutMode === 'login'
                              ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                              : 'border-border/50 hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              checkoutMode === 'login' ? 'bg-green-500/20' : 'bg-muted'
                            }`}>
                              <LogIn className={`h-5 w-5 ${checkoutMode === 'login' ? 'text-green-600' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                              <p className="font-medium">Anmelden</p>
                              <p className="text-sm text-muted-foreground">
                                Mit bestehendem Konto bestellen
                              </p>
                            </div>
                            {checkoutMode === 'login' && (
                              <Check className="ml-auto h-5 w-5 text-green-600" />
                            )}
                          </div>
                        </button>

                        {/* Login Form */}
                        {checkoutMode === 'login' && (
                          <form onSubmit={handleLogin} className="mt-4 p-4 rounded-xl bg-muted/30 space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="loginEmail">E-Mail</Label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="loginEmail"
                                  type="email"
                                  value={loginEmail}
                                  onChange={(e) => setLoginEmail(e.target.value)}
                                  placeholder="ihre@email.ch"
                                  className="pl-10 rounded-xl"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="loginPassword">Passwort</Label>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="loginPassword"
                                  type="password"
                                  value={loginPassword}
                                  onChange={(e) => setLoginPassword(e.target.value)}
                                  placeholder="••••••••"
                                  className="pl-10 rounded-xl"
                                />
                              </div>
                            </div>
                            <Button
                              type="submit"
                              disabled={isLoggingIn}
                              className="w-full rounded-xl"
                            >
                              {isLoggingIn ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Anmelden...
                                </>
                              ) : (
                                <>
                                  <LogIn className="mr-2 h-4 w-4" />
                                  Anmelden
                                </>
                              )}
                            </Button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Shipping */}
          {currentStep === 'shipping' && (
            <>
              {/* Contact Info */}
              <Card className="card-elegant overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      <User className="h-4 w-4" />
                    </div>
                    Kontaktdaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Vor- und Nachname"
                        className="rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-Mail *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="ihre@email.ch"
                        className="rounded-xl"
                        required
                      />
                    </div>
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
                      className="rounded-xl"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Method */}
              <Card className="card-elegant overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      <Truck className="h-4 w-4" />
                    </div>
                    Versandart
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <RadioGroup
                    value={shippingMethod}
                    onValueChange={(val) => setShippingMethod(val as ShippingMethodType)}
                    className="divide-y"
                  >
                    {shippingOptions.map((option) => (
                      <label
                        key={option.type}
                        className={`flex items-center justify-between px-6 py-4 cursor-pointer transition-all duration-300 ${
                          shippingMethod === option.type
                            ? 'bg-green-50 dark:bg-green-950/50'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={option.type} id={option.type} />
                          <div>
                            <span className="font-medium">{option.name}</span>
                            <p className="text-sm text-muted-foreground">
                              {option.description}
                            </p>
                          </div>
                        </div>
                        <span className={`font-semibold ${option.priceCents === 0 ? 'text-emerald-600' : ''}`}>
                          {option.priceCents === 0 ? 'Kostenlos' : formatPrice(option.priceCents)}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>

                  {freeShipping && (
                    <div className="px-6 py-4 flex items-center gap-2 text-sm text-emerald-600 border-t">
                      <Sparkles className="h-4 w-4" />
                      Kostenloser Versand ab CHF 50 Bestellwert!
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Shipping Address */}
              {shippingMethod !== 'pickup' && shippingMethod !== 'none' && (
                <Card className="card-elegant overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                    <CardTitle>Lieferadresse</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="street">Strasse und Hausnummer *</Label>
                      <Input
                        id="street"
                        name="street"
                        value={formData.street}
                        onChange={handleInputChange}
                        placeholder="Musterstrasse 123"
                        className="rounded-xl"
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
                        className="rounded-xl"
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
                          className="rounded-xl"
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
                          className="rounded-xl"
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
                        className="rounded-xl bg-muted/30"
                        disabled
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              <Card className="card-elegant overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                  <CardTitle>Bemerkungen (optional)</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <Textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Besondere Anweisungen zur Lieferung..."
                    rows={3}
                    className="rounded-xl resize-none"
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
                <Card className="card-elegant overflow-hidden mb-6">
                  <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      Kontaktdaten
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Ihr vollstaendiger Name"
                          className="rounded-xl"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">E-Mail *</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="ihre@email.ch"
                          className="rounded-xl"
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
              <Card className="card-elegant overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    Zahlungsmethode waehlen
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(val) => setPaymentMethod(val as PaymentMethodType)}
                    className="space-y-3"
                  >
                    {/* Online Payment */}
                    <label
                      className={`flex items-start justify-between rounded-xl border-2 p-4 cursor-pointer transition-all duration-300 ${
                        paymentMethod === 'online'
                          ? 'border-primary bg-primary/5 shadow-glow-sm'
                          : 'border-border/50 hover:border-primary/30 hover:bg-primary/5'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value="online" id="online" className="mt-1" />
                        <div>
                          <span className="font-medium flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            Online bezahlen
                          </span>
                          <p className="text-sm text-muted-foreground mt-1">
                            Sicher mit Kreditkarte, TWINT oder weiteren Zahlungsmethoden
                          </p>
                          <div className="flex items-center gap-2 mt-3">
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
                        className={`flex items-start justify-between rounded-xl border-2 p-4 cursor-pointer transition-all duration-300 ${
                          paymentMethod === 'pay_at_venue'
                            ? 'border-primary bg-primary/5 shadow-glow-sm'
                            : 'border-border/50 hover:border-primary/30 hover:bg-primary/5'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <RadioGroupItem value="pay_at_venue" id="pay_at_venue" className="mt-1" />
                          <div>
                            <span className="font-medium flex items-center gap-2">
                              <Store className="h-4 w-4 text-primary" />
                              Im Salon bezahlen
                            </span>
                            <p className="text-sm text-muted-foreground mt-1">
                              Bezahlen Sie bequem bei der Abholung im Salon
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                              <Badge variant="secondary" className="text-xs">Bar</Badge>
                              <Badge variant="secondary" className="text-xs">Karte</Badge>
                              <Badge variant="secondary" className="text-xs">TWINT</Badge>
                            </div>
                          </div>
                        </div>
                      </label>
                    )}
                  </RadioGroup>

                  {/* Info for pay at venue */}
                  {paymentMethod === 'pay_at_venue' && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">Hinweis zur Abholung</p>
                        <p>
                          Ihre Bestellung wird fuer Sie reserviert. Bitte holen Sie diese
                          innerhalb von 7 Tagen ab und bezahlen Sie bei Abholung.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Summary Card */}
              <Card className="card-elegant overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                  <CardTitle>Bestellung bestaetigen</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {/* Order Summary */}
                  <div className="space-y-4 mb-6">
                    <div className="p-4 rounded-xl bg-muted/30">
                      <h4 className="font-medium mb-2 text-sm text-muted-foreground">Kontakt</h4>
                      <p className="font-medium">{formData.name}</p>
                      <p className="text-sm text-muted-foreground">{formData.email}</p>
                    </div>

                    {shippingMethod !== 'none' && (
                      <div className="p-4 rounded-xl bg-muted/30">
                        <h4 className="font-medium mb-2 text-sm text-muted-foreground">Versand</h4>
                        {shippingMethod === 'pickup' ? (
                          <p className="font-medium flex items-center gap-2">
                            <Store className="h-4 w-4 text-primary" />
                            Abholung im Salon
                          </p>
                        ) : (
                          <p className="font-medium">
                            {formData.street}
                            {formData.street2 && `, ${formData.street2}`}
                            <br />
                            <span className="text-muted-foreground">{formData.zip} {formData.city}</span>
                          </p>
                        )}
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-muted/30">
                      <h4 className="font-medium mb-2 text-sm text-muted-foreground">Zahlungsmethode</h4>
                      <p className="font-medium flex items-center gap-2">
                        {paymentMethod === 'online' ? (
                          <>
                            <CreditCard className="h-4 w-4 text-primary" />
                            Online bezahlen
                          </>
                        ) : (
                          <>
                            <Store className="h-4 w-4 text-primary" />
                            Im Salon bezahlen
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  {/* Items */}
                  <div className="space-y-3">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-medium">
                          {formatPrice(item.totalPriceCents)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-6" />

                  <p className="text-sm text-muted-foreground">
                    {paymentMethod === 'online' ? (
                      <>
                        Durch Klicken auf &ldquo;Jetzt bezahlen&rdquo; werden Sie zu unserem
                        sicheren Zahlungsanbieter weitergeleitet.
                      </>
                    ) : (
                      <>
                        Durch Klicken auf &ldquo;Bestellung aufgeben&rdquo; reservieren wir
                        Ihre Bestellung. Sie bezahlen bei Abholung.
                      </>
                    )}
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            {currentStepIndex > 0 ? (
              <Button variant="outline" onClick={handlePrevStep} disabled={isSubmitting} className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurueck
              </Button>
            ) : (
              <Button variant="outline" asChild className="rounded-xl">
                <Link href="/shop">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Weiter einkaufen
                </Link>
              </Button>
            )}

            {currentStep === 'payment' ? (
              <Button onClick={handleSubmitOrder} disabled={isSubmitting} size="lg" className="btn-glow rounded-xl">
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
              <Button onClick={handleNextStep} className="rounded-xl">
                Weiter
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 space-y-6">
            <Card className="card-elegant overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                <CardTitle>Bestelluebersicht</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <CartSummary compact showShipping={currentStep !== 'cart'} />
              </CardContent>
            </Card>

            {/* Trust Badges */}
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-primary" />
                Sichere Zahlung
              </div>
              <div className="flex justify-center gap-3">
                <Badge variant="outline" className="text-xs">Visa</Badge>
                <Badge variant="outline" className="text-xs">Mastercard</Badge>
                <Badge variant="outline" className="text-xs">TWINT</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                SSL-verschluesselte Verbindung
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
