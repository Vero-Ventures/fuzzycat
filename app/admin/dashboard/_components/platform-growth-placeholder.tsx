import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PlatformGrowthPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform Growth</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Chart coming soon</p>
        </div>
      </CardContent>
    </Card>
  );
}
