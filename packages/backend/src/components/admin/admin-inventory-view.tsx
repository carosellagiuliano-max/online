'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  Plus,
  Minus,
  History,
  Download,
  RefreshCw,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  MOCK_STORE_KEYS,
  readMockCollection,
  addToMockCollection,
  mockId,
} from '@/lib/mock/mock-store';

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

// ============================================
// TYPES
// ============================================

interface InventoryVariant {
  id: string;
  productId: string;
  productName: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  priceCents: number;
  isActive: boolean;
}

interface InventoryProduct {
  id: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  priceCents: number;
  categoryName: string | null;
  isActive: boolean;
  isLowStock: boolean;
  variants: InventoryVariant[];
}

interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  movementType: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface InventoryStats {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
}

interface AdminInventoryViewProps {
  products: InventoryProduct[];
  movements: StockMovement[];
  stats: InventoryStats;
}

/** Im Demo-Modus persistierte Bestandsanpassung (localStorage). */
interface MockInventoryAdjustment {
  productId: string;
  delta: number;
  movementType: string;
  notes: string | null;
  createdAt: string;
}

// ============================================
// HELPERS
// ============================================

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function getMovementTypeBadge(type: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  const badges: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    sale: { variant: 'destructive', label: 'Verkauf' },
    purchase: { variant: 'default', label: 'Einkauf' },
    adjustment: { variant: 'secondary', label: 'Korrektur' },
    return: { variant: 'outline', label: 'Rückgabe' },
    damaged: { variant: 'destructive', label: 'Beschädigt' },
    transfer: { variant: 'outline', label: 'Transfer' },
  };
  return badges[type] || { variant: 'secondary', label: type };
}

// ============================================
// COMPONENT
// ============================================

export function AdminInventoryView({
  products,
  movements,
  stats,
}: AdminInventoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<InventoryVariant | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('adjustment');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [productList, setProductList] = useState<InventoryProduct[]>(products);
  const [movementList, setMovementList] = useState<StockMovement[]>(movements);

  // Demo-Modus: persistierte Anpassungen nach dem Mounten anwenden
  // (im useEffect, um Hydration-Fehler zu vermeiden)
  useEffect(() => {
    if (!isMockMode) return;

    const adjustments = readMockCollection<MockInventoryAdjustment>(
      MOCK_STORE_KEYS.inventoryAdjustments
    );
    if (adjustments.length === 0) return;

    const stockById = new Map(products.map((p) => [p.id, p.stockQuantity]));
    const nameById = new Map(products.map((p) => [p.id, p.name]));
    const synthesized: StockMovement[] = [];

    adjustments.forEach((adjustment, index) => {
      const previous = stockById.get(adjustment.productId);
      if (previous === undefined) return;
      const next = previous + adjustment.delta;
      stockById.set(adjustment.productId, next);
      synthesized.push({
        id: `mock-adjustment-${index}`,
        productId: adjustment.productId,
        productName: nameById.get(adjustment.productId) ?? 'Unbekannt',
        variantId: null,
        variantName: null,
        movementType: adjustment.movementType,
        quantity: adjustment.delta,
        previousQuantity: previous,
        newQuantity: next,
        notes: adjustment.notes,
        createdBy: 'Demo Admin',
        createdAt: adjustment.createdAt,
      });
    });

    setProductList(
      products.map((p) => {
        const quantity = stockById.get(p.id) ?? p.stockQuantity;
        return quantity === p.stockQuantity
          ? p
          : { ...p, stockQuantity: quantity, isLowStock: quantity <= p.lowStockThreshold };
      })
    );
    // Neueste Bewegung zuerst (wie die Server-Daten sortiert sind)
    setMovementList([...synthesized.reverse(), ...movements]);
  }, [products, movements]);

  // Demo-Modus: Statistik-Karten aus dem aktuellen Bestand ableiten
  const displayedStats: InventoryStats = isMockMode
    ? {
        totalProducts: productList.length,
        lowStockCount: productList.filter(
          (p) => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold
        ).length,
        outOfStockCount: productList.filter((p) => p.stockQuantity <= 0).length,
        totalValue: productList.reduce((sum, p) => sum + p.stockQuantity * p.priceCents, 0),
      }
    : stats;

  // Filter products
  const filteredProducts = productList.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    const matchesStockFilter =
      stockFilter === 'all' ||
      (stockFilter === 'low' && product.isLowStock && product.stockQuantity > 0) ||
      (stockFilter === 'out' && product.stockQuantity <= 0);

    return matchesSearch && matchesStockFilter;
  });

  // Toggle expanded variants
  const toggleExpand = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Open adjustment dialog for product
  const handleAdjustStock = (product: InventoryProduct) => {
    setSelectedProduct(product);
    setSelectedVariant(null);
    setAdjustmentType('add');
    setAdjustmentQuantity('');
    setAdjustmentReason('adjustment');
    setAdjustmentNotes('');
    setAdjustDialogOpen(true);
  };

  // Open adjustment dialog for variant
  const handleAdjustVariantStock = (product: InventoryProduct, variant: InventoryVariant) => {
    setSelectedProduct(product);
    setSelectedVariant(variant);
    setAdjustmentType('add');
    setAdjustmentQuantity('');
    setAdjustmentReason('adjustment');
    setAdjustmentNotes('');
    setAdjustDialogOpen(true);
  };

  // Submit stock adjustment
  const handleSubmitAdjustment = async () => {
    if (!selectedProduct || !adjustmentQuantity) return;

    const qty = parseInt(adjustmentQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Bitte geben Sie eine gültige Menge ein');
      return;
    }

    // Demo-Modus: Anpassung lokal anwenden und im Browser speichern (kein API-Aufruf)
    if (isMockMode) {
      const delta = adjustmentType === 'add' ? qty : -qty;
      const previous =
        productList.find((p) => p.id === selectedProduct.id)?.stockQuantity ??
        selectedProduct.stockQuantity;
      const next = previous + delta;

      if (next < 0) {
        toast.error('Der Bestand kann nicht negativ werden');
        return;
      }

      const createdAt = new Date().toISOString();
      const movement: StockMovement = {
        id: mockId('mov'),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        variantId: null,
        variantName: null,
        movementType: adjustmentReason,
        quantity: delta,
        previousQuantity: previous,
        newQuantity: next,
        notes: adjustmentNotes || null,
        createdBy: 'Demo Admin',
        createdAt,
      };

      setProductList((prev) =>
        prev.map((p) =>
          p.id === selectedProduct.id
            ? { ...p, stockQuantity: next, isLowStock: next <= p.lowStockThreshold }
            : p
        )
      );
      setMovementList((prev) => [movement, ...prev]);
      addToMockCollection<MockInventoryAdjustment>(MOCK_STORE_KEYS.inventoryAdjustments, {
        productId: selectedProduct.id,
        delta,
        movementType: adjustmentReason,
        notes: adjustmentNotes || null,
        createdAt,
      });

      toast.success(
        `Bestand ${adjustmentType === 'add' ? 'erhöht' : 'reduziert'}: ${qty} Stück (Demo-Modus)`
      );
      setAdjustDialogOpen(false);
      return;
    }

    setIsAdjusting(true);

    try {
      const response = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: adjustmentType === 'add' ? qty : -qty,
          movementType: adjustmentReason,
          notes: adjustmentNotes,
          variantId: selectedVariant?.id || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Fehler beim Anpassen des Bestands');
      }

      toast.success(
        `Bestand ${adjustmentType === 'add' ? 'erhöht' : 'reduziert'}: ${qty} Stück`
      );
      setAdjustDialogOpen(false);

      // Refresh page to get updated data
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Anpassen des Bestands');
    } finally {
      setIsAdjusting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Produkt', 'Variante', 'SKU', 'Bestand', 'Schwellwert', 'Kategorie', 'Status'];
    const rows: string[][] = [];

    filteredProducts.forEach((p) => {
      rows.push([
        p.name,
        '',
        p.sku || '',
        p.stockQuantity.toString(),
        p.lowStockThreshold.toString(),
        p.categoryName || '',
        p.stockQuantity <= 0 ? 'Ausverkauft' : p.isLowStock ? 'Niedrig' : 'OK',
      ]);
      p.variants.forEach((v) => {
        rows.push([
          p.name,
          v.name,
          v.sku || '',
          v.stockQuantity.toString(),
          '',
          '',
          v.stockQuantity <= 0 ? 'Ausverkauft' : 'OK',
        ]);
      });
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventar-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('CSV exportiert');
  };

  const adjustDialogLabel = selectedVariant
    ? `${selectedProduct?.name} - ${selectedVariant.name}`
    : selectedProduct?.name || '';

  const adjustDialogCurrentStock = selectedVariant
    ? selectedVariant.stockQuantity
    : selectedProduct?.stockQuantity ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventar</h1>
          <p className="text-muted-foreground">
            Bestandsübersicht und Lagerbewegungen
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          CSV Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produkte</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayedStats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              mit Bestandsverfolgung
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Niedriger Bestand</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {displayedStats.lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              unter Schwellwert
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ausverkauft</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {displayedStats.outOfStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Produkte ohne Bestand
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lagerwert</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(displayedStats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Gesamtwert (Einkaufspreis)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Bestandsübersicht</TabsTrigger>
          <TabsTrigger value="movements">Lagerbewegungen</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suchen nach Name oder SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={stockFilter}
              onValueChange={(value) => setStockFilter(value as typeof stockFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Produkte</SelectItem>
                <SelectItem value="low">Niedriger Bestand</SelectItem>
                <SelectItem value="out">Ausverkauft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Products Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">Bestand</TableHead>
                  <TableHead className="text-right">Schwellwert</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      Keine Produkte gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <Fragment key={product.id}>
                      <TableRow>
                        <TableCell className="w-[30px] pr-0">
                          {product.variants.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleExpand(product.id)}
                            >
                              <ChevronRight
                                className={cn(
                                  'h-4 w-4 transition-transform',
                                  expandedProducts.has(product.id) && 'rotate-90'
                                )}
                              />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {product.name}
                            {product.variants.length > 0 && (() => {
                              const hasOutOfStock = product.variants.some(v => v.stockQuantity <= 0);
                              const hasLowStock = product.variants.some(v => v.stockQuantity > 0 && v.stockQuantity <= product.lowStockThreshold);
                              return (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-xs',
                                    hasOutOfStock && 'border-red-500 text-red-600',
                                    !hasOutOfStock && hasLowStock && 'border-yellow-500 text-yellow-600'
                                  )}
                                >
                                  <Layers className="h-3 w-3 mr-1" />
                                  {product.variants.length}
                                </Badge>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.sku || '-'}
                        </TableCell>
                        <TableCell>{product.categoryName || '-'}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'font-medium',
                              product.stockQuantity <= 0 && 'text-red-600',
                              product.isLowStock &&
                                product.stockQuantity > 0 &&
                                'text-yellow-600'
                            )}
                          >
                            {product.stockQuantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {product.lowStockThreshold}
                        </TableCell>
                        <TableCell>
                          {product.stockQuantity <= 0 ? (
                            <Badge variant="destructive">Ausverkauft</Badge>
                          ) : product.isLowStock ? (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              Niedrig
                            </Badge>
                          ) : (
                            <Badge variant="outline">OK</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAdjustStock(product)}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Anpassen
                          </Button>
                        </TableCell>
                      </TableRow>
                      {/* Variant rows */}
                      {expandedProducts.has(product.id) &&
                        product.variants.map((variant) => (
                          <TableRow key={variant.id} className="bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell className="pl-8 text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Layers className="h-3 w-3" />
                                {variant.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {variant.sku || '-'}
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right">
                              <span
                                className={cn(
                                  'font-medium',
                                  variant.stockQuantity <= 0 && 'text-red-600'
                                )}
                              >
                                {variant.stockQuantity}
                              </span>
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell>
                              {variant.stockQuantity <= 0 ? (
                                <Badge variant="destructive">Ausverkauft</Badge>
                              ) : (
                                <Badge variant="outline">OK</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAdjustVariantStock(product, variant)}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Anpassen
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Letzte Lagerbewegungen
              </CardTitle>
              <CardDescription>
                Die letzten 50 Bestandsänderungen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead className="text-right">Menge</TableHead>
                    <TableHead className="text-right">Vorher</TableHead>
                    <TableHead className="text-right">Nachher</TableHead>
                    <TableHead>Notiz</TableHead>
                    <TableHead>Benutzer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        Keine Lagerbewegungen vorhanden
                      </TableCell>
                    </TableRow>
                  ) : (
                    movementList.map((movement) => {
                      const badge = getMovementTypeBadge(movement.movementType);
                      return (
                        <TableRow key={movement.id}>
                          <TableCell className="text-muted-foreground">
                            {formatDate(movement.createdAt)}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>
                              {movement.productName}
                              {movement.variantName && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({movement.variantName})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                'font-medium',
                                movement.quantity > 0 && 'text-green-600',
                                movement.quantity < 0 && 'text-red-600'
                              )}
                            >
                              {movement.quantity > 0 ? '+' : ''}
                              {movement.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {movement.previousQuantity}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {movement.newQuantity}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-muted-foreground">
                            {movement.notes || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {movement.createdBy || 'System'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bestand anpassen</DialogTitle>
            <DialogDescription>
              {adjustDialogLabel} - Aktueller Bestand: {adjustDialogCurrentStock}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Add or Remove */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={adjustmentType === 'add' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAdjustmentType('add')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Hinzufügen
              </Button>
              <Button
                type="button"
                variant={adjustmentType === 'remove' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAdjustmentType('remove')}
              >
                <Minus className="mr-2 h-4 w-4" />
                Entfernen
              </Button>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Menge</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                placeholder="Anzahl eingeben..."
                value={adjustmentQuantity}
                onChange={(e) => setAdjustmentQuantity(e.target.value)}
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Grund</Label>
              <Select value={adjustmentReason} onValueChange={setAdjustmentReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Einkauf / Wareneingang</SelectItem>
                  <SelectItem value="adjustment">Inventurkorrektur</SelectItem>
                  <SelectItem value="return">Kundenrückgabe</SelectItem>
                  <SelectItem value="damaged">Beschädigt / Defekt</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notizen (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Zusätzliche Informationen..."
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmitAdjustment} disabled={isAdjusting}>
              {isAdjusting ? 'Wird gespeichert...' : 'Bestand anpassen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
