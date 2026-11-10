import {
  AdPlacement,
  CouponType,
  OrderStatus,
  PaymentMode,
  PaymentProvider,
  PaymentStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Password123!';

type ProductSeed = {
  name: string;
  description?: string;
  price: number;
  mrp?: number;
  stock_quantity: number;
  image_url?: string;
  image_width?: number;
  image_height?: number;
  image_bg_color?: string;
  category?: string;
};

type BusinessSeed = {
  slug: string;
  ownerEmail: string;
  name: string;
  description: string;
  logo_url: string;
  banner_url: string;
  images: string[];
  amenities: string[];
  category: string;
  address: string;
  phone: string;
  rating: number;
  ratings_count: number;
  trend_score: number;
  is_featured: boolean;
  upi_id?: string;
  payment_qr_url?: string;
  accepts_internal_payments: boolean;
  timings: { day: string; open: string; close: string }[];
  products: ProductSeed[];
};

const USERS: {
  email: string;
  name: string;
  phone: string;
  role: Role;
}[] = [
  { email: 'admin@dukaanhub.local', name: 'DukaanHub Admin', phone: '9000000000', role: Role.admin },
  { email: 'seller@dukaanhub.local', name: 'Rakesh Sharma', phone: '9876543210', role: Role.seller },
  { email: 'seller2@dukaanhub.local', name: 'Meera Kapoor', phone: '9876500001', role: Role.seller },
  { email: 'seller3@dukaanhub.local', name: 'Arjun Verma', phone: '9999900001', role: Role.seller },
  { email: 'buyer@dukaanhub.local', name: 'Demo Buyer', phone: '9812345678', role: Role.buyer },
  { email: 'buyer2@dukaanhub.local', name: 'Riya Singh', phone: '9812345679', role: Role.buyer },
];

const CATEGORIES: {
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
  children?: { name: string; slug: string; icon: string; sort_order: number }[];
}[] = [
  {
    name: 'Grocery',
    slug: 'grocery',
    icon: 'basket',
    sort_order: 1,
    children: [
      { name: 'Rice & Grains', slug: 'rice-grains', icon: 'rice', sort_order: 1 },
      { name: 'Oils', slug: 'oils', icon: 'oil', sort_order: 2 },
      { name: 'Beverages', slug: 'beverages', icon: 'cup', sort_order: 3 },
    ],
  },
  {
    name: 'Fashion',
    slug: 'fashion',
    icon: 'shirt',
    sort_order: 2,
    children: [
      { name: 'Ethnic Wear', slug: 'ethnic-wear', icon: 'dress', sort_order: 1 },
      { name: 'Bags', slug: 'bags', icon: 'bag', sort_order: 2 },
    ],
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    icon: 'phone',
    sort_order: 3,
    children: [
      { name: 'Audio', slug: 'audio', icon: 'headphones', sort_order: 1 },
      { name: 'Accessories', slug: 'accessories', icon: 'cable', sort_order: 2 },
    ],
  },
  {
    name: 'Food',
    slug: 'food',
    icon: 'cake',
    sort_order: 4,
    children: [
      { name: 'Cakes', slug: 'cakes', icon: 'cake', sort_order: 1 },
      { name: 'Bakery', slug: 'bakery', icon: 'bread', sort_order: 2 },
    ],
  },
  {
    name: 'Home',
    slug: 'home',
    icon: 'home',
    sort_order: 5,
    children: [{ name: 'Decor', slug: 'decor', icon: 'lamp', sort_order: 1 }],
  },
  {
    name: 'Health',
    slug: 'health',
    icon: 'heart',
    sort_order: 6,
    children: [{ name: 'Protein', slug: 'protein', icon: 'dumbbell', sort_order: 1 }],
  },
];

const BUSINESSES: BusinessSeed[] = [
  {
    slug: 'sharma-kirana',
    ownerEmail: 'seller@dukaanhub.local',
    name: 'Sharma Kirana Store',
    description: 'Daily essentials, groceries and snacks at best prices.',
    logo_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200',
    banner_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
    images: [
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
      'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800',
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800',
    ],
    amenities: ['Free delivery', 'Cash on delivery', 'Same-day delivery'],
    category: 'Grocery',
    address: 'Sector 12, Noida',
    phone: '9876543210',
    rating: 4.6,
    ratings_count: 312,
    trend_score: 920,
    is_featured: true,
    upi_id: 'sharmakirana@upi',
    payment_qr_url: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=sharmakirana@upi',
    accepts_internal_payments: true,
    timings: [
      { day: 'Mon-Sat', open: '08:00', close: '22:00' },
      { day: 'Sun', open: '09:00', close: '21:00' },
    ],
    products: [
      {
        name: 'Basmati Rice 5kg',
        description: 'Long-grain aged basmati rice.',
        price: 420,
        mrp: 520,
        stock_quantity: 50,
        image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
        image_width: 400,
        image_height: 267,
        image_bg_color: '#E8DCC8',
        category: 'rice-grains',
      },
      {
        name: 'Sunflower Oil 1L',
        price: 165,
        mrp: 190,
        stock_quantity: 80,
        image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400',
        image_width: 400,
        image_height: 555,
        image_bg_color: '#E9C46A',
        category: 'oils',
      },
      {
        name: 'Tea 500g',
        price: 210,
        stock_quantity: 40,
        image_url: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400',
        image_width: 400,
        image_height: 267,
        image_bg_color: '#C89F5F',
        category: 'beverages',
      },
      {
        name: 'Sugar 1kg',
        price: 48,
        stock_quantity: 100,
        image_url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400',
        image_width: 400,
        image_height: 400,
        image_bg_color: '#EDE7E0',
      },
    ],
  },
  {
    slug: 'trendy-threads',
    ownerEmail: 'seller2@dukaanhub.local',
    name: 'Trendy Threads Boutique',
    description: 'Ethnic and western wear for women.',
    logo_url: 'https://images.unsplash.com/photo-1441984904996-e0b6ba6977c6?w=200',
    banner_url: 'https://images.unsplash.com/photo-1441984904996-e0b6ba6977c6?w=800',
    images: [
      'https://images.unsplash.com/photo-1441984904996-e0b6ba6977c6?w=800',
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800',
    ],
    amenities: ['Doorstep delivery', 'Easy returns', 'Paid delivery'],
    category: 'Fashion',
    address: 'Lajpat Nagar, Delhi',
    phone: '9876500001',
    rating: 4.4,
    ratings_count: 188,
    trend_score: 740,
    is_featured: true,
    upi_id: 'trendythreads@upi',
    accepts_internal_payments: true,
    timings: [{ day: 'Mon-Sun', open: '10:00', close: '21:00' }],
    products: [
      {
        name: 'Kurti Set',
        price: 899,
        mrp: 1299,
        stock_quantity: 20,
        image_url: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400',
        image_bg_color: '#C9A7A0',
        category: 'ethnic-wear',
      },
      {
        name: 'Saree',
        price: 1499,
        mrp: 1999,
        stock_quantity: 12,
        image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400',
        image_width: 400,
        image_height: 600,
        image_bg_color: '#A3546E',
        category: 'ethnic-wear',
      },
      {
        name: 'Handbag',
        price: 699,
        stock_quantity: 18,
        image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400',
        image_width: 400,
        image_height: 533,
        image_bg_color: '#B08968',
        category: 'bags',
      },
    ],
  },
  {
    slug: 'techzone',
    ownerEmail: 'seller3@dukaanhub.local',
    name: 'TechZone Electronics',
    description: 'Mobiles, accessories and gadgets.',
    logo_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200',
    banner_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800',
    images: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800'],
    amenities: ['Warranty provided', 'Installation support', 'Cash on delivery'],
    category: 'Electronics',
    address: 'Gurugram',
    phone: '9999900001',
    rating: 4.7,
    ratings_count: 540,
    trend_score: 880,
    is_featured: false,
    accepts_internal_payments: true,
    timings: [{ day: 'Mon-Sun', open: '10:00', close: '20:00' }],
    products: [
      {
        name: 'Wireless Earbuds',
        price: 1299,
        mrp: 1999,
        stock_quantity: 30,
        image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400',
        image_width: 400,
        image_height: 225,
        image_bg_color: '#3F4750',
        category: 'audio',
      },
      {
        name: 'Phone Case',
        price: 299,
        stock_quantity: 60,
        image_url: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400',
        image_width: 400,
        image_height: 707,
        image_bg_color: '#6B7280',
        category: 'accessories',
      },
    ],
  },
  {
    slug: 'freshbake',
    ownerEmail: 'seller@dukaanhub.local',
    name: 'FreshBake Bakery',
    description: 'Cakes, breads and fresh pastries.',
    logo_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200',
    banner_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
    images: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800'],
    amenities: ['Same-day delivery', 'Cash on delivery'],
    category: 'Food',
    address: 'Indirapuram',
    phone: '9123456789',
    rating: 4.8,
    ratings_count: 420,
    trend_score: 950,
    is_featured: true,
    accepts_internal_payments: true,
    timings: [{ day: 'Mon-Sun', open: '07:00', close: '23:00' }],
    products: [
      {
        name: 'Chocolate Cake 1kg',
        description: 'Rich Belgian chocolate ganache.',
        price: 650,
        mrp: 800,
        stock_quantity: 10,
        image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400',
        image_width: 400,
        image_height: 294,
        image_bg_color: '#5A3825',
        category: 'cakes',
      },
      {
        name: 'Garlic Bread',
        price: 120,
        stock_quantity: 25,
        image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
        image_width: 400,
        image_height: 266,
        image_bg_color: '#C99A5B',
        category: 'bakery',
      },
    ],
  },
  {
    slug: 'homedecor',
    ownerEmail: 'seller2@dukaanhub.local',
    name: 'Home Decor Studio',
    description: 'Handcrafted decor and gifts.',
    logo_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=200',
    banner_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800',
    images: ['https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800'],
    amenities: ['Wholesaler discount', 'Bulk vending only', 'Paid delivery'],
    category: 'Home',
    address: 'Connaught Place',
    phone: '9000011111',
    rating: 4.3,
    ratings_count: 96,
    trend_score: 610,
    is_featured: false,
    upi_id: 'homedecor@upi',
    payment_qr_url: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=homedecor@upi',
    accepts_internal_payments: false,
    timings: [{ day: 'Mon-Sat', open: '10:00', close: '19:00' }],
    products: [
      {
        name: 'Wall Hanging',
        price: 799,
        stock_quantity: 15,
        image_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400',
        image_width: 400,
        image_height: 267,
        image_bg_color: '#8C7A6B',
        category: 'decor',
      },
    ],
  },
  {
    slug: 'fitfuel',
    ownerEmail: 'seller3@dukaanhub.local',
    name: 'FitFuel Supplements',
    description: 'Protein, vitamins and fitness gear.',
    logo_url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200',
    banner_url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
    images: ['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800'],
    amenities: ['Free delivery', 'Cash on delivery'],
    category: 'Health',
    address: 'Sector 62, Noida',
    phone: '9876000000',
    rating: 4.5,
    ratings_count: 230,
    trend_score: 790,
    is_featured: false,
    accepts_internal_payments: true,
    timings: [{ day: 'Mon-Sun', open: '09:00', close: '21:00' }],
    products: [
      {
        name: 'Whey Protein 1kg',
        price: 1899,
        mrp: 2499,
        stock_quantity: 25,
        image_url: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=400',
        image_width: 400,
        image_height: 600,
        image_bg_color: '#4B5563',
        category: 'protein',
      },
    ],
  },
];

const COUPONS = [
  {
    code: 'SAVE10',
    title: '10% OFF',
    description: 'Get 10% off up to ₹100 on orders above ₹500',
    type: CouponType.percent,
    value: 10,
    max_discount: 100,
    min_order: 500,
  },
  {
    code: 'FLAT50',
    title: '₹50 OFF',
    description: 'Flat ₹50 off on orders above ₹300',
    type: CouponType.flat,
    value: 50,
    max_discount: null,
    min_order: 300,
  },
  {
    code: 'NEWUSER',
    title: '15% OFF',
    description: 'New users get 15% off (max ₹200)',
    type: CouponType.percent,
    value: 15,
    max_discount: 200,
    min_order: 0,
  },
];

async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const users = new Map<string, string>();
  for (const user of USERS) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        phone: user.phone,
        role: user.role,
        password_hash: passwordHash,
      },
      create: {
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        password_hash: passwordHash,
      },
    });
    users.set(record.email, record.id);
  }

  const categoryIds = new Map<string, string>();
  for (const parent of CATEGORIES) {
    const parentRecord = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, icon: parent.icon, sort_order: parent.sort_order },
      create: {
        name: parent.name,
        slug: parent.slug,
        icon: parent.icon,
        sort_order: parent.sort_order,
      },
    });
    categoryIds.set(parent.slug, parentRecord.id);

    for (const child of parent.children ?? []) {
      const childRecord = await prisma.category.upsert({
        where: { slug: child.slug },
        update: {
          name: child.name,
          icon: child.icon,
          sort_order: child.sort_order,
          parent_id: parentRecord.id,
        },
        create: {
          name: child.name,
          slug: child.slug,
          icon: child.icon,
          sort_order: child.sort_order,
          parent_id: parentRecord.id,
        },
      });
      categoryIds.set(child.slug, childRecord.id);
    }
  }

  const businesses = new Map<string, { id: string; ownerId: string }>();
  const products = new Map<string, string>();
  for (const seedBusiness of BUSINESSES) {
    const ownerId = users.get(seedBusiness.ownerEmail);
    if (!ownerId) throw new Error(`Missing owner ${seedBusiness.ownerEmail}`);

    const data = {
      owner_id: ownerId,
      name: seedBusiness.name,
      description: seedBusiness.description,
      logo_url: seedBusiness.logo_url,
      banner_url: seedBusiness.banner_url,
      images: seedBusiness.images,
      amenities: seedBusiness.amenities,
      category: seedBusiness.category,
      address: seedBusiness.address,
      phone: seedBusiness.phone,
      timings: seedBusiness.timings,
      rating: seedBusiness.rating,
      ratings_count: seedBusiness.ratings_count,
      trend_score: seedBusiness.trend_score,
      is_featured: seedBusiness.is_featured,
      upi_id: seedBusiness.upi_id ?? null,
      payment_qr_url: seedBusiness.payment_qr_url ?? null,
      accepts_internal_payments: seedBusiness.accepts_internal_payments,
    };

    const business = await prisma.business.upsert({
      where: { slug: seedBusiness.slug },
      update: data,
      create: { slug: seedBusiness.slug, ...data },
    });
    businesses.set(seedBusiness.slug, { id: business.id, ownerId });

    await prisma.businessPage.upsert({
      where: { business_id_slug: { business_id: business.id, slug: 'about-us' } },
      update: {
        title: 'About Us',
        content: `${seedBusiness.name} has been serving customers in ${seedBusiness.address}.`,
        images: [seedBusiness.banner_url],
        is_published: true,
      },
      create: {
        business_id: business.id,
        title: 'About Us',
        slug: 'about-us',
        content: `${seedBusiness.name} has been serving customers in ${seedBusiness.address}.`,
        images: [seedBusiness.banner_url],
        is_published: true,
      },
    });

    await prisma.businessPage.upsert({
      where: { business_id_slug: { business_id: business.id, slug: 'returns' } },
      update: { title: 'Returns & Refunds', content: 'Contact the store within 24 hours for issues.', is_published: true },
      create: {
        business_id: business.id,
        title: 'Returns & Refunds',
        slug: 'returns',
        content: 'Contact the store within 24 hours for issues.',
        is_published: true,
      },
    });

    for (const seedProduct of seedBusiness.products) {
      const existing = await prisma.product.findFirst({
        where: { business_id: business.id, name: seedProduct.name },
        select: { id: true },
      });
      const productData = {
        business_id: business.id,
        name: seedProduct.name,
        description: seedProduct.description ?? null,
        price: seedProduct.price,
        mrp: seedProduct.mrp ?? null,
        stock_quantity: seedProduct.stock_quantity,
        image_url: seedProduct.image_url ?? null,
        image_width: seedProduct.image_width ?? null,
        image_height: seedProduct.image_height ?? null,
        image_bg_color: seedProduct.image_bg_color ?? null,
        category_id: seedProduct.category ? (categoryIds.get(seedProduct.category) ?? null) : null,
        is_active: true,
      };

      const product = existing
        ? await prisma.product.update({ where: { id: existing.id }, data: productData })
        : await prisma.product.create({ data: productData });
      products.set(`${seedBusiness.slug}:${seedProduct.name}`, product.id);
    }
  }

  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {
        title: coupon.title,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        max_discount: coupon.max_discount,
        min_order: coupon.min_order,
        is_active: true,
      },
      create: {
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        max_discount: coupon.max_discount,
        min_order: coupon.min_order,
        is_active: true,
      },
    });
  }

  const ads: {
    businessSlug?: string;
    title: string;
    image_url: string;
    link_url?: string;
    placement: AdPlacement;
  }[] = [
    {
      businessSlug: 'sharma-kirana',
      title: 'Fresh groceries in 30 minutes',
      image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
      link_url: '/business/sharma-kirana',
      placement: AdPlacement.home,
    },
    {
      businessSlug: 'freshbake',
      title: 'Same-day cakes & bakes',
      image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
      link_url: '/business/freshbake',
      placement: AdPlacement.carousel,
    },
    {
      businessSlug: 'techzone',
      title: 'Latest audio deals',
      image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800',
      link_url: '/business/techzone',
      placement: AdPlacement.search,
    },
  ];

  const now = new Date();
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  for (const ad of ads) {
    const business = ad.businessSlug ? businesses.get(ad.businessSlug) : undefined;
    const existing = await prisma.ad.findFirst({
      where: { title: ad.title, business_id: business?.id ?? null },
      select: { id: true },
    });
    if (!existing) {
      await prisma.ad.create({
        data: {
          business_id: business?.id ?? null,
          title: ad.title,
          image_url: ad.image_url,
          link_url: ad.link_url,
          placement: ad.placement,
          starts_at: now,
          ends_at: inThirtyDays,
          is_active: true,
        },
      });
    }
  }

  const buyerId = users.get('buyer@dukaanhub.local');
  if (!buyerId) throw new Error('Missing demo buyer');

  const kirana = businesses.get('sharma-kirana');
  const bakery = businesses.get('freshbake');
  const riceId = products.get('sharma-kirana:Basmati Rice 5kg');
  const cakeId = products.get('freshbake:Chocolate Cake 1kg');

  if (kirana && riceId) {
    const existing = await prisma.order.findUnique({ where: { order_number: 'DH-2026-0001' } });
    if (!existing) {
      await prisma.order.create({
        data: {
          order_number: 'DH-2026-0001',
          buyer_id: buyerId,
          business_id: kirana.id,
          subtotal: 420,
          discount: 0,
          delivery_fee: 0,
          handling_fee: 2,
          tip_amount: 0,
          donation_amount: 0,
          total: 422,
          payment_mode: PaymentMode.internal,
          payment_status: PaymentStatus.paid,
          status: OrderStatus.delivered,
          payment_reference: 'PAY-SEED-0001',
          delivery_address: {
            label: 'Home',
            line1: '221B Baker Street',
            city: 'Noida',
            state: 'Uttar Pradesh',
            pincode: '201301',
            phone: '9812345678',
          },
          items: {
            create: [
              {
                product_id: riceId,
                name: 'Basmati Rice 5kg',
                price: 420,
                quantity: 1,
                subtotal: 420,
              },
            ],
          },
          payments: {
            create: [
              {
                provider: PaymentProvider.mock,
                reference: 'PAY-SEED-0001',
                amount: 422,
                currency: 'INR',
                status: PaymentStatus.paid,
              },
            ],
          },
        },
      });
    }
  }

  if (bakery && cakeId) {
    const existing = await prisma.order.findUnique({ where: { order_number: 'DH-2026-0002' } });
    if (!existing) {
      await prisma.order.create({
        data: {
          order_number: 'DH-2026-0002',
          buyer_id: buyerId,
          business_id: bakery.id,
          subtotal: 650,
          discount: 0,
          delivery_fee: 0,
          handling_fee: 2,
          tip_amount: 0,
          donation_amount: 0,
          total: 652,
          payment_mode: PaymentMode.external,
          payment_status: PaymentStatus.pending,
          status: OrderStatus.confirmed,
          delivery_address: {
            label: 'Home',
            line1: '221B Baker Street',
            city: 'Noida',
            state: 'Uttar Pradesh',
            pincode: '201301',
            phone: '9812345678',
          },
          items: {
            create: [
              {
                product_id: cakeId,
                name: 'Chocolate Cake 1kg',
                price: 650,
                quantity: 1,
                subtotal: 650,
              },
            ],
          },
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log('Demo accounts (password: Password123!):');
  for (const user of USERS) console.log(`  ${user.role.padEnd(6)} ${user.email}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
