'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Download, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface QRCodeDownloadProps {
  websiteUrl: string | null;
  logoUrl: string | null;
  salonName: string;
}

// Helper to draw a rounded rectangle
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Create a logo image with rounded square white background
function createPaddedLogoUrl(logoUrl: string, padding: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Use a fixed canvas size for consistency
      const canvasSize = 200;
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const cornerRadius = 20; // Rounded corner radius

      // Draw rounded square white background
      roundRect(ctx, 0, 0, canvasSize, canvasSize, cornerRadius);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Draw logo with padding
      const logoSize = canvasSize - padding * 2;
      ctx.drawImage(img, padding, padding, logoSize, logoSize);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load logo'));
    img.src = logoUrl;
  });
}

export function QRCodeDownload({ websiteUrl, logoUrl, salonName }: QRCodeDownloadProps) {
  const qrCanvasRef = useRef<HTMLDivElement>(null);
  const qrSvgRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [paddedLogoUrl, setPaddedLogoUrl] = useState<string | null>(null);

  const sizeMap = {
    small: 200,
    medium: 300,
    large: 500,
  };

  const qrSize = sizeMap[size];
  const logoDisplaySize = qrSize * 0.28; // Size including padding

  // Create padded logo when logoUrl changes
  useEffect(() => {
    if (!logoUrl) {
      setPaddedLogoUrl(null);
      return;
    }

    createPaddedLogoUrl(logoUrl, 8)
      .then(setPaddedLogoUrl)
      .catch((err) => {
        console.error('Failed to create padded logo:', err);
        setPaddedLogoUrl(null);
      });
  }, [logoUrl]);

  const downloadQRCode = useCallback(() => {
    const filename = `${salonName.toLowerCase().replace(/\s+/g, '-')}-qr-code`;

    if (format === 'png') {
      if (!qrCanvasRef.current) return;
      const canvas = qrCanvasRef.current.querySelector('canvas');
      if (!canvas) return;

      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = url;
      link.click();
    } else {
      if (!qrSvgRef.current) return;
      const svg = qrSvgRef.current.querySelector('svg');
      if (!svg) return;

      // Clone and serialize the SVG
      const svgClone = svg.cloneNode(true) as SVGElement;
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const svgData = new XMLSerializer().serializeToString(svgClone);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${filename}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [format, salonName]);

  if (!websiteUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR-Code
          </CardTitle>
          <CardDescription>
            QR-Code für Ihre Website erstellen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Bitte fügen Sie zuerst eine Website-URL in den allgemeinen Einstellungen hinzu.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR-Code
        </CardTitle>
        <CardDescription>
          Laden Sie einen QR-Code mit dem Link zu Ihrer Website herunter
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code Preview */}
        <div className="flex justify-center">
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            {/* Canvas version (for PNG) */}
            <div ref={qrCanvasRef} className={format === 'png' ? '' : 'hidden'}>
              <QRCodeCanvas
                value={websiteUrl}
                size={qrSize}
                level="H"
                marginSize={2}
                imageSettings={paddedLogoUrl ? {
                  src: paddedLogoUrl,
                  height: logoDisplaySize,
                  width: logoDisplaySize,
                  excavate: false,
                } : undefined}
              />
            </div>
            {/* SVG version (for SVG download) */}
            <div ref={qrSvgRef} className={format === 'svg' ? '' : 'hidden'}>
              <QRCodeSVG
                value={websiteUrl}
                size={qrSize}
                level="H"
                marginSize={2}
                imageSettings={paddedLogoUrl ? {
                  src: paddedLogoUrl,
                  height: logoDisplaySize,
                  width: logoDisplaySize,
                  excavate: false,
                } : undefined}
              />
            </div>
          </div>
        </div>

        {/* URL Display */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Verlinkt zu:</p>
          <p className="font-medium text-primary break-all">{websiteUrl}</p>
        </div>

        {/* Options */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="qr-size">Grösse</Label>
            <Select value={size} onValueChange={(v) => setSize(v as 'small' | 'medium' | 'large')}>
              <SelectTrigger id="qr-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Klein (200px)</SelectItem>
                <SelectItem value="medium">Mittel (300px)</SelectItem>
                <SelectItem value="large">Gross (500px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qr-format">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as 'png' | 'svg')}>
              <SelectTrigger id="qr-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG (Bild)</SelectItem>
                <SelectItem value="svg">SVG (Vektor)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Download Button */}
        <Button onClick={downloadQRCode} className="w-full" size="lg">
          <Download className="h-4 w-4 mr-2" />
          QR-Code herunterladen
        </Button>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            {logoUrl
              ? '✓ Ihr Logo wird in der Mitte des QR-Codes angezeigt.'
              : '💡 Tipp: Laden Sie ein Logo hoch, um es in der Mitte des QR-Codes anzuzeigen.'}
          </p>
          <p>Der QR-Code kann auf Flyern, Visitenkarten oder im Schaufenster verwendet werden.</p>
        </div>
      </CardContent>
    </Card>
  );
}
