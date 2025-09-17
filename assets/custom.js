 // Enhanced variant image functionality for Custom Product Card
document.addEventListener('DOMContentLoaded', function() {
  class CustomProductCard extends HTMLElement {
    constructor() {
      super();
      this.productId = null;
      this.productHandle = null;
      this.variants = [];
      this.selectedVariant = null;
      this.productData = null;
      this.defaultImage = null;
      this.variantImages = new Map(); // Cache for variant images
      this.imageTransition = false;
    }

    connectedCallback() {
      setTimeout(() => this.init(), 50);
    }

    init() {
      this.loadProductData();
      this.cacheElements();
      this.bindEvents();
      this.setDefaultImage();
    //   this.buildVariantImageMap(); // New: Build image mapping
      this.preselectFirstAvailable();
      this.updateVariantSelection();
    }

    // ... (keeping existing loadProductData, fetchProductDataByHandle, cacheElements, bindEvents methods)

    loadProductData() {
      const productCard = this.closest('[data-product-card]');
      if (productCard) {
        this.productId = productCard.dataset.productCard;
        this.productHandle = productCard.dataset.productHandle;
      }
      const variantDataScript = this.querySelector('.variant-data');
      if (variantDataScript) {
        try {
          const parsed = JSON.parse(variantDataScript.textContent.trim());
          if (parsed.json) {
            this.productData = parsed.json;
            this.variants = parsed.json.variants || [];
          }
        } catch(e) {
          console.error('Variant data parse error', e);
        }
      }
      if (!this.variants.length && this.productHandle) {
        this.fetchProductDataByHandle(this.productHandle);
      }
    }

    async fetchProductDataByHandle(handle) {
      try {
        const res = await fetch(`/products/${handle}.js`);
        if (res.ok) {
          const data = await res.json();
          this.productData = data;
          this.variants = data.variants || [];
          this.buildVariantImageMap(); // Rebuild after fetching
        }
      } catch(e) { console.error(e); }
    }

    cacheElements() {
      this.sizeSelect = this.querySelector('.size-select');
      this.colorRadios = this.querySelectorAll('.color-radio');
      this.addToCartBtn = this.querySelector('.add-to-cart-btn');
      this.variantPrice = this.querySelector('.variant-price');
      this.outOfStockMsg = this.querySelector('.out-of-stock');
      this.form = this.querySelector('.product-form');
      
      // Image elements
      this.mediaContainer = this.querySelector('.card__media .media');
      this.primaryImage = this.mediaContainer ? this.mediaContainer.querySelector('img:first-child') : null;
      this.secondaryImage = this.mediaContainer ? this.mediaContainer.querySelector('img:last-child') : null;
      
      // Create image loading indicator
      this.createImageLoader();
    }

    bindEvents() {
      if (this.sizeSelect) {
        this.sizeSelect.addEventListener('change', () => this.updateVariantSelection());
      }
      if (this.colorRadios.length) {
        const container = this.querySelector('.color-options');
        container.addEventListener('change', (e) => {
          if (e.target.matches('.color-radio:checked')) this.updateVariantSelection();
        });
      }
      if (this.form) {
        this.form.addEventListener('submit', e => this.handleAddToCart(e));
      }

      // Add image preloading on hover for better UX
      this.addEventListener('mouseenter', () => this.preloadVariantImages());
    }

    createImageLoader() {
      if (!this.mediaContainer) return;
      
      this.imageLoader = document.createElement('div');
      this.imageLoader.className = 'image-loader';
      this.imageLoader.innerHTML = '<div class="loader-spinner"></div>';
      this.imageLoader.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: none;
        z-index: 10;
      `;
      
      // Add CSS for spinner if not exists
      if (!document.querySelector('#variant-image-loader-styles')) {
        const style = document.createElement('style');
        style.id = 'variant-image-loader-styles';
        style.textContent = `
          .image-loader .loader-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #333;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .variant-image-transition {
            transition: opacity 0.3s ease-in-out;
          }
        `;
        document.head.appendChild(style);
      }
      
      this.mediaContainer.style.position = 'relative';
      this.mediaContainer.appendChild(this.imageLoader);
    }

    // NEW: Build a comprehensive variant image mapping
    buildVariantImageMap() {
      if (!this.productData || !this.variants) return;
      
      this.variantImages.clear();
      
      // Map each variant to its images
      this.variants.forEach(variant => {
        const images = this.getVariantImages(variant);
        if (images.length > 0) {
          this.variantImages.set(variant.id, images);
        }
      });
      
      console.log('Variant image map built:', this.variantImages);
    }

    // NEW: Get all images associated with a variant
    getVariantImages(variant) {
      const images = [];
      
      // 1. Variant's featured image (highest priority)
      if (variant.featured_image) {
        images.push({
          ...variant.featured_image,
          type: 'variant_featured'
        });
      }
      
      // 2. Images from product media that are associated with this variant
      if (this.productData.media) {
        const variantMedia = this.productData.media.filter(media => 
          media.variant_ids && media.variant_ids.includes(variant.id)
        );
        
        variantMedia.forEach(media => {
          // Avoid duplicates
          if (!images.find(img => img.src === media.src)) {
            images.push({
              ...media,
              type: 'variant_media'
            });
          }
        });
      }
      
      // 3. If no specific images, try to match by color/option
      if (images.length === 0 && this.productData.media) {
        const matchedImages = this.findImagesByVariantOptions(variant);
        images.push(...matchedImages);
      }
      
      return images;
    }

    // NEW: Find images by matching variant option names (like color)
    findImagesByVariantOptions(variant) {
      const images = [];
      
      if (!this.productData.options || !this.productData.media) return images;
      
      // Get variant options
      const variantOptions = variant.options || [];
      
      // Look for images with alt text matching variant options
      this.productData.media.forEach(media => {
        if (media.alt) {
          const altText = media.alt.toLowerCase();
          const matchesOption = variantOptions.some(option => {
            if (!option) return false;
            const optionText = option.toString().toLowerCase();
            return altText.includes(optionText) || optionText.includes(altText);
          });
          
          if (matchesOption) {
            images.push({
              ...media,
              type: 'option_matched'
            });
          }
        }
      });
      
      return images;
    }

    setDefaultImage() {
      if (this.primaryImage && this.primaryImage.src) {
        this.defaultImage = {
          src: this.primaryImage.src,
          srcset: this.primaryImage.srcset,
          alt: this.primaryImage.alt,
          width: this.primaryImage.width,
          height: this.primaryImage.height
        };
      }
      
      if (this.secondaryImage && this.secondaryImage.src && this.secondaryImage !== this.primaryImage) {
        this.defaultSecondaryImage = {
          src: this.secondaryImage.src,
          srcset: this.secondaryImage.srcset,
          alt: this.secondaryImage.alt,
          width: this.secondaryImage.width,
          height: this.secondaryImage.height
        };
      }
    }

    // ... (keeping existing methods until updateVariantImage)

    preselectFirstAvailable() {
      if (!this.selectedVariant && this.variants.length) {
        const v = this.variants.find(v => v.available) || this.variants[0];
        if (!v) return;
        (this.productData?.options || []).forEach((name, idx) => {
          const key = name.toLowerCase();
          const val = v.options[idx];
          if (key.includes('size') || key.includes('größe')) {
            if (this.sizeSelect) this.sizeSelect.value = val;
          }
          if (key.includes('color') || key.includes('colour') || key.includes('farbe')) {
            const radio = Array.from(this.colorRadios).find(r => r.value === val);
            if (radio) radio.checked = true;
          }
        });
      }
    }

    getSelectedOptions() {
      const opts = {};
      if (this.sizeSelect && this.sizeSelect.value) opts.size = this.sizeSelect.value;
      const selColor = this.querySelector('.color-radio:checked');
      if (selColor) opts.color = selColor.value;
      return opts;
    }

    findMatchingVariant(selectedOptions) {
      const optionNames = (this.productData?.options || [])
        .map(o => (o || '').toString().toLowerCase().normalize('NFKD').replace(/[^\w]/g,''));
      return this.variants.find(variant => {
        return optionNames.every((on, idx) => {
          const key =
            on.includes('size') || on.includes('große') || on.includes('größe') ? 'size' :
            on.includes('color') || on.includes('colour') || on.includes('farbe') ? 'color' : null;
          if (!key || !selectedOptions[key]) return true;
          const norm = v => (v || '').toString().trim();
          return norm(variant.options[idx]) === norm(selectedOptions[key]);
        });
      });
    }

    updateVariantSelection() {
      const selectedOptions = this.getSelectedOptions();
      this.selectedVariant = this.findMatchingVariant(selectedOptions);
      this.updateUI();
    }

    updateUI() {
      this.updateAddToCartButton();
      this.updateStockStatus();
      this.updateVariantImage();
    }

    // ENHANCED: Improved variant image updating with better logic
    async updateVariantImage() {
      if (!this.primaryImage || !this.mediaContainer) return;

      this.showImageLoader(true);

      try {
        let primaryImageData = null;
        let secondaryImageData = null;

        if (this.selectedVariant) {
          // Get images for selected variant
          const variantImages = this.variantImages.get(this.selectedVariant.id) || [];
          
          if (variantImages.length > 0) {
            primaryImageData = variantImages[0]; // First image as primary
            secondaryImageData = variantImages[1] || null; // Second as hover if exists
            
            console.log(`Using variant images for variant ${this.selectedVariant.id}:`, variantImages);
          }
        }

        // Fallback logic
        if (!primaryImageData) {
          if (this.productData?.featured_media) {
            primaryImageData = this.productData.featured_media;
            if (this.productData.media && this.productData.media.length > 1) {
              secondaryImageData = this.productData.media[1];
            }
          } else if (this.defaultImage) {
            primaryImageData = this.defaultImage;
            secondaryImageData = this.defaultSecondaryImage;
          }
        }

        // Update images with smooth transition
        if (primaryImageData) {
          await this.updateImageElementSmooth(this.primaryImage, primaryImageData);
        }

        if (this.secondaryImage) {
          if (secondaryImageData) {
            await this.updateImageElementSmooth(this.secondaryImage, secondaryImageData);
            this.secondaryImage.style.display = '';
          } else {
           
          }
        }

        // Update price display for selected variant
        this.updateVariantPrice();

      } catch (error) {
        console.error('Error updating variant image:', error);
      } finally {
        this.showImageLoader(false);
      }
    }

    // NEW: Update price display
    updateVariantPrice() {
      const priceContainer = this.querySelector('.variant-price-main');
      const comparePriceContainer = this.querySelector('.variant-price-compare');
      
      if (this.selectedVariant && priceContainer) {
        // Format price (you may need to adjust this based on your shop's currency format)
        const price = (this.selectedVariant.price / 100).toFixed(2);
        priceContainer.textContent = `$${price}`;
        
        if (comparePriceContainer) {
          if (this.selectedVariant.compare_at_price > this.selectedVariant.price) {
            const comparePrice = (this.selectedVariant.compare_at_price / 100).toFixed(2);
            comparePriceContainer.textContent = `$${comparePrice}`;
            comparePriceContainer.style.display = '';
          } else {
            comparePriceContainer.style.display = 'none';
          }
        }
      }
    }

    // NEW: Smooth image transition
    async updateImageElementSmooth(imageElement, imageData) {
      return new Promise((resolve) => {
        if (!imageElement || !imageData || this.imageTransition) {
          resolve();
          return;
        }

        this.imageTransition = true;
        imageElement.classList.add('variant-image-transition');

        // Fade out
        imageElement.style.opacity = '0.3';

        setTimeout(() => {
          this.updateImageElement(imageElement, imageData);
          
          // Fade in
          imageElement.style.opacity = '1';
          
          setTimeout(() => {
            this.imageTransition = false;
            resolve();
          }, 300);
        }, 150);
      });
    }

    updateImageElement(imageElement, imageData) {
      if (!imageElement || !imageData) return;

      // Handle different image data formats
      if (imageData.src || imageData.url) {
        const baseUrl = imageData.src || imageData.url;
        
        if (baseUrl.includes('shopify') || baseUrl.includes('cdn')) {
          // Generate responsive srcset for Shopify images
          const sizes = [165, 360, 533, 720, 940, 1066];
          const srcsetParts = sizes
            .filter(size => size <= (imageData.width || 2048))
            .map(size => `${this.getShopifyImageUrl(baseUrl, size)} ${size}w`);
          
          imageElement.src = this.getShopifyImageUrl(baseUrl, 533);
          if (srcsetParts.length > 0) {
            imageElement.srcset = srcsetParts.join(', ');
          }
        } else {
          imageElement.src = baseUrl;
        }
        
        imageElement.alt = imageData.alt || this.selectedVariant?.title || this.productData?.title || '';
        
        if (imageData.width) imageElement.width = imageData.width;
        if (imageData.height) imageElement.height = imageData.height;
      }
    }

    getShopifyImageUrl(url, width) {
      if (!url || typeof url !== 'string') return url;
      
      let cleanUrl = url.replace(/_(pico|icon|thumb|small|compact|medium|large|grande|original|master|\d+x\d*|\d*x\d+|x\d+)\./g, '.');
      
      if (width) {
        cleanUrl = cleanUrl.replace(/(\.[^.]+)$/, `_${width}x$1`);
      }
      
      return cleanUrl;
    }

    // NEW: Show/hide image loader
    showImageLoader(show) {
      if (!this.imageLoader) return;
      this.imageLoader.style.display = show ? 'block' : '';
    }

    // NEW: Preload variant images for better performance
    preloadVariantImages() {
      if (this.variantImages.size === 0) return;
      
      this.variantImages.forEach((images, variantId) => {
        images.forEach(imageData => {
          if (imageData.src || imageData.url) {
            const img = new Image();
            img.src = this.getShopifyImageUrl(imageData.src || imageData.url, 533);
          }
        });
      });
    }

    // NEW: Get current variant image info for debugging
    getCurrentVariantImageInfo() {
      if (!this.selectedVariant) return null;
      
      return {
        variantId: this.selectedVariant.id,
        variantTitle: this.selectedVariant.title,
        images: this.variantImages.get(this.selectedVariant.id) || [],
        selectedOptions: this.getSelectedOptions()
      };
    }

    // ... (keeping all existing methods for cart functionality)
   updateAddToCartButton() {
          console.log('tiggerd 10');

  if (!this.addToCartBtn) return;

  if (this.hasRequiredSelections()) {
    if (this.selectedVariant && this.selectedVariant.available) {
      this.addToCartBtn.disabled = false;
      this.addToCartBtn.innerHTML= '<span style="">ADD</span>'
    } else {
      this.addToCartBtn.disabled = true;
      this.addToCartBtn.innerHTML= '<span style="">ADD</span>'
    }
  } else {
    this.addToCartBtn.disabled = true;
    this.addToCartBtn.innerHTML= '<span style="">ADD</span>'
  }
}


    hasRequiredSelections() {
      if (this.variants.length <= 1) return true;
      if (this.sizeSelect && !this.sizeSelect.value) return false;
      if (this.colorRadios.length && !this.querySelector('.color-radio:checked')) return false;
      return true;
    }

    updateStockStatus() {
      if (!this.outOfStockMsg) return;
      this.outOfStockMsg.style.display =
        this.selectedVariant && !this.selectedVariant.available ? 'block' : 'none';
    }

    async handleAddToCart(e) {
      e.preventDefault();
      if (!this.selectedVariant) return this.showMessage('Please select product options', 'error');
      if (!this.selectedVariant.available) return this.showMessage('Out of stock', 'error');
      
      const qty = 1;
      
      try {
        this.setLoadingState(true);
        
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        
        const isCartEmpty = await this.isCartEmpty();
        
        const formData = new FormData();
        formData.append('id', this.selectedVariant.id);
        formData.append('quantity', qty);
        
        if (this.cart) {
          const sectionsToRender = this.cart.getSectionsToRender ? this.cart.getSectionsToRender() : [];
          if (sectionsToRender.length) {
            formData.append('sections', sectionsToRender.map(section => section.id));
            formData.append('sections_url', window.location.pathname);
          }
        }
        
        const addUrl = window.routes?.cart_add_url || '/cart/add.js';
        
        const res = await fetch(addUrl, {
          method: 'POST',
          headers: { 
            'Accept': 'application/javascript',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: formData
        });
        
        if (res.ok) {
          const addResponse = await res.json();
          console.log('Add to cart response:', addResponse);
          
          if (addResponse.status) {
            console.error('Cart add error:', addResponse.errors || addResponse.description);
            this.showMessage(addResponse.description || 'Failed to add to cart', 'error');
            return;
          }
          
          if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
            publish(PUB_SUB_EVENTS.cartUpdate, {
              source: 'custom-product-card',
              productVariantId: this.selectedVariant.id,
              cartData: addResponse,
            });
          }
          
          if (this.cart && typeof this.cart.renderContents === 'function') {
            this.cart.renderContents(addResponse);
            console.log('Cart drawer/notification updated with Dawn method');
          }
          
          await this.updateCartCount();
           this.updateAddToCartButton();
          console.log('Cart operation completed tiggerd');
          
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error('Add to cart failed:', res.status, errorData);
          this.showMessage(errorData.description || 'Failed to add to cart', 'error');
        }
      } catch (error) {
        console.error('Add to cart error:', error);
        this.showMessage('Failed to add to cart', 'error');
      } finally {
        if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
        this.setLoadingState(false);
      }
    }

    async isCartEmpty() {
      try {
        const res = await fetch('/cart.js');
        const cart = await res.json();
        return cart.item_count === 0;
      } catch(e) {
        console.error('Failed to check cart status:', e);
        return false;
      }
    }

    setLoadingState(loading) {
      if (!this.addToCartBtn) return;
      const btnText = this.addToCartBtn.querySelector('.btn-text');
      if (loading) {
        this.addToCartBtn.disabled = true;
        if (btnText) btnText.innerHTML = '<span style="color:#000">Adding...</span>';
      } else {
        this.updateAddToCartButton();
      }
    }

    showMessage(msg, type) {
      let el = this.querySelector('.cart-message');
      if (!el) {
        el = document.createElement('div');
        el.className = 'cart-message';
        (this.form || this).appendChild(el);
      }
      el.textContent = msg;
      el.className = `cart-message cart-message--${type}`;
      setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
    }

    async updateCartCount() {
      try {
        const res = await fetch('/cart.js');
        const cart = await res.json();
        console.log('Cart quantity update:', cart.item_count);
        
        const el = document.querySelector('.cart-count, [data-cart-count], .cart-count-badge');
        if (el) {
          el.textContent = cart.item_count;
          console.log('Cart icon updated with count:', cart.item_count);
        } else {
          console.warn('Cart count element not found');
        }
        
        return cart;
      } catch(e) { 
        console.error('Failed to update cart count:', e);
        return null;
      }
    }
  }

  if (!customElements.get('custom-product-card')) {
    customElements.define('custom-product-card', CustomProductCard);
  }
});

document.addEventListener('DOMContentLoaded', function() {
  // Handle custom cart button clicks
  document.addEventListener('click', function(e) {
    if (e.target.closest('.custom-cart-button')) {
      const button = e.target.closest('.custom-cart-button');
      const variantId = button.dataset.variantId;
      const productId = button.dataset.productId;
      
      if (button.disabled) return;
      
      // Store original button state
      const originalText = button.textContent;
      const originalHtml = button.innerHTML;
      
      // Disable button and show loading state
      button.disabled = true;
      button.classList.add('loading');
      
      // Update button text to show loading
      const btnText = button.querySelector('.btn-text') || button;
      btnText.textContent = 'Adding...';
      
      // Get cart components for updates
      const cart = document.querySelector('cart-notification') || 
                   document.querySelector('cart-drawer') || 
                   document.querySelector('cart-popup');
      
      // Prepare form data with sections for cart updates
      const formData = new FormData();
      formData.append('id', variantId);
      formData.append('quantity', 1);
      
      // Add sections to render if cart component exists
      if (cart && cart.getSectionsToRender) {
        const sectionsToRender = cart.getSectionsToRender();
        if (sectionsToRender.length) {
          formData.append('sections', sectionsToRender.map(section => section.id));
          formData.append('sections_url', window.location.pathname);
        }
      }
      
      // Check if cart is currently empty for proper state management
      isCartEmpty()
        .then(cartEmpty => {
          // Add to cart request
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: {
              'Accept': 'application/javascript',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
          });
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Check for cart API errors
          if (data.status) {
            throw new Error(data.description || 'Failed to add item to cart');
          }
          
          console.log('Added to cart:', data);
          
          // Success handling
          handleCartSuccess(button, data, cart, originalText, originalHtml);
        })
        .catch(error => {
          console.error('Error adding to cart:', error);
          handleCartError(button, error, originalText, originalHtml);
        });
    }
  });
  
  // Helper function to check if cart is empty
  async function isCartEmpty() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      return cart.item_count === 0;
    } catch (error) {
      console.error('Failed to check cart status:', error);
      return false;
    }
  }
  
  // Handle successful cart addition
  function handleCartSuccess(button, cartData, cartComponent, originalText, originalHtml) {
    // Show success state
    button.classList.remove('loading');
    button.classList.add('success');
    
    const btnText = button.querySelector('.btn-text') || button;
    btnText.textContent = 'Added!';
    
    // Publish cart update event for theme compatibility
    if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'custom-cart-button',
        productVariantId: cartData.variant_id || cartData.id,
        cartData: cartData,
      });
    }
    
    // Update cart drawer/notification if available
    if (cartComponent) {
      // Remove empty state if cart was empty
      if (cartComponent.classList.contains('is-empty')) {
        cartComponent.classList.remove('is-empty');
      }
      
      // Update cart contents using theme's method
      if (typeof cartComponent.renderContents === 'function') {
        cartComponent.renderContents(cartData);
      }
      
      // Open cart drawer/notification
      if (typeof cartComponent.open === 'function') {
        cartComponent.open();
      } else if (cartComponent.classList.contains('cart-drawer')) {
        cartComponent.classList.add('active', 'animate');
        document.body.classList.add('overflow-hidden');
      } else if (cartComponent.classList.contains('cart-notification')) {
        cartComponent.classList.add('animate', 'active');
      }
    }
    
    // Update cart count in header
    updateCartCount();
    
    // Show success notification using Dawn's existing system
    // showCartNotification('Item added to cart!', 'success', cartData);
    
    // Dispatch custom cart updated event
    document.dispatchEvent(new CustomEvent('cart:updated', {
      detail: {
        cartData: cartData,
        source: 'custom-cart-button'
      }
    }));
    
    // Reset button after delay
    setTimeout(() => {
      resetButton(button, originalText, originalHtml);
    }, 2000);
  }
  
  // Handle cart addition errors
  function handleCartError(button, error, originalText, originalHtml) {
    button.classList.remove('loading');
    button.classList.add('error');
    
    const btnText = button.querySelector('.btn-text') || button;
    btnText.textContent = 'Error';
    
    // Log error (Dawn theme will handle error display through cart component)
    const errorMessage = error.message || 'Failed to add item to cart';
    console.error('Cart error:', errorMessage);
    
    // Reset button after delay
    setTimeout(() => {
      resetButton(button, originalText, originalHtml);
    }, 3000);
  }
  
  // Reset button to original state
  function resetButton(button, originalText, originalHtml) {
    button.disabled = false;
    button.classList.remove('loading', 'success', 'error');
    
    // Restore original content
    if (button.querySelector('.btn-text')) {
      button.querySelector('.btn-text').textContent = originalText;
    } else {
      button.innerHTML = originalHtml;
    }
  }
  
  // Update cart count in header
  async function updateCartCount() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      
      // Update various possible cart count selectors
      const cartCountSelectors = [
        '.cart-count',
        '[data-cart-count]',
        '.cart-count-badge',
        '.cart-link__bubble',
        '.cart-count-bubble'
      ];
      
      cartCountSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.textContent = cart.item_count;
          
          // Show/hide cart count bubble
          if (cart.item_count > 0) {
            element.classList.remove('hidden');
            element.style.display = '';
          } else {
            element.classList.add('hidden');
          }
        });
      });
      
      console.log('Cart count updated:', cart.item_count);
      return cart;
    } catch (error) {
      console.error('Failed to update cart count:', error);
      return null;
    }
  }
  
  // Use Dawn theme's existing notification system
  function showCartNotification(message, type = 'success', cartData = null) {
    // Try to use Dawn's cart notification system
    const cartNotification = document.querySelector('cart-notification');
    
    if (cartNotification && typeof cartNotification.renderContents === 'function') {
      // Use Dawn's built-in notification - it will show automatically after cart update
      return;
    }
    
    // Fallback: Use browser's built-in notifications or simple alert for errors
    if (type === 'error') {
      console.error(message);
      // You could add a simple CSS-only notification here if needed
    } else {
      console.log(message);
    }
  }
  
  // Add minimal button loading styles only
  function addButtonStyles() {
    
    
    
  }
  
  // Initialize cart state management
  function initCartState() {
    // Add minimal button styles
    addButtonStyles();
    
    // Listen for cart updates from other sources
    document.addEventListener('cart:updated', function(e) {
      updateCartCount();
    });
    
    // Handle page visibility changes to sync cart state
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        updateCartCount();
      }
    });
  }
  
  // Initialize when DOM is ready
  initCartState();
});























// sale page card




















 // Enhanced variant image functionality for Custom Product Card
document.addEventListener('DOMContentLoaded', function() {
  class SaleProductCard extends HTMLElement {
    constructor() {
      super();
      this.productId = null;
      this.productHandle = null;
      this.variants = [];
      this.selectedVariant = null;
      this.productData = null;
      this.defaultImage = null;
      this.variantImages = new Map(); // Cache for variant images
      this.imageTransition = false;
    }

    connectedCallback() {
      setTimeout(() => this.init(), 50);
    }

    init() {
      this.loadProductData();
      this.cacheElements();
      this.bindEvents();
      this.setDefaultImage();
    //   this.buildVariantImageMap(); // New: Build image mapping
      this.preselectFirstAvailable();
      this.updateVariantSelection();
    }

    // ... (keeping existing loadProductData, fetchProductDataByHandle, cacheElements, bindEvents methods)

    loadProductData() {
      const productCard = this.closest('[data-product-card]');
      if (productCard) {
        this.productId = productCard.dataset.productCard;
        this.productHandle = productCard.dataset.productHandle;
      }
      const variantDataScript = this.querySelector('.variant-data');
      if (variantDataScript) {
        try {
          const parsed = JSON.parse(variantDataScript.textContent.trim());
          if (parsed.json) {
            this.productData = parsed.json;
            this.variants = parsed.json.variants || [];
          }
        } catch(e) {
          console.error('Variant data parse error', e);
        }
      }
      if (!this.variants.length && this.productHandle) {
        this.fetchProductDataByHandle(this.productHandle);
      }
    }

    async fetchProductDataByHandle(handle) {
      try {
        const res = await fetch(`/products/${handle}.js`);
        if (res.ok) {
          const data = await res.json();
          this.productData = data;
          this.variants = data.variants || [];
          this.buildVariantImageMap(); // Rebuild after fetching
        }
      } catch(e) { console.error(e); }
    }

    cacheElements() {
      this.sizeSelect = this.querySelector('.size-select');
      this.colorRadios = this.querySelectorAll('.color-radio');
      this.addToCartBtn = this.querySelector('.add-to-cart-btn');
      this.variantPrice = this.querySelector('.variant-price');
      this.outOfStockMsg = this.querySelector('.out-of-stock');
      this.form = this.querySelector('.product-form');
      
      // Image elements
      this.mediaContainer = this.querySelector('.card__media .media');
      this.primaryImage = this.mediaContainer ? this.mediaContainer.querySelector('img:first-child') : null;
      this.secondaryImage = this.mediaContainer ? this.mediaContainer.querySelector('img:last-child') : null;
      
      // Create image loading indicator
      this.createImageLoader();
    }

    bindEvents() {
      if (this.sizeSelect) {
        this.sizeSelect.addEventListener('change', () => this.updateVariantSelection());
      }
      if (this.colorRadios.length) {
        const container = this.querySelector('.color-options');
        container.addEventListener('change', (e) => {
          if (e.target.matches('.color-radio:checked')) this.updateVariantSelection();
        });
      }
      if (this.form) {
        this.form.addEventListener('submit', e => this.handleAddToCart(e));
      }

      // Add image preloading on hover for better UX
      this.addEventListener('mouseenter', () => this.preloadVariantImages());
    }

    createImageLoader() {
      if (!this.mediaContainer) return;
      
      this.imageLoader = document.createElement('div');
      this.imageLoader.className = 'image-loader';
      this.imageLoader.innerHTML = '<div class="loader-spinner"></div>';
      this.imageLoader.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: none;
        z-index: 10;
      `;
      
      // Add CSS for spinner if not exists
      if (!document.querySelector('#variant-image-loader-styles')) {
        const style = document.createElement('style');
        style.id = 'variant-image-loader-styles';
        style.textContent = `
          .image-loader .loader-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #333;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .variant-image-transition {
            transition: opacity 0.3s ease-in-out;
          }
        `;
        document.head.appendChild(style);
      }
      
      this.mediaContainer.style.position = 'relative';
      this.mediaContainer.appendChild(this.imageLoader);
    }

    // NEW: Build a comprehensive variant image mapping
    buildVariantImageMap() {
      if (!this.productData || !this.variants) return;
      
      this.variantImages.clear();
      
      // Map each variant to its images
      this.variants.forEach(variant => {
        const images = this.getVariantImages(variant);
        if (images.length > 0) {
          this.variantImages.set(variant.id, images);
        }
      });
      
      console.log('Variant image map built:', this.variantImages);
    }

    // NEW: Get all images associated with a variant
    getVariantImages(variant) {
      const images = [];
      
      // 1. Variant's featured image (highest priority)
      if (variant.featured_image) {
        images.push({
          ...variant.featured_image,
          type: 'variant_featured'
        });
      }
      
      // 2. Images from product media that are associated with this variant
      if (this.productData.media) {
        const variantMedia = this.productData.media.filter(media => 
          media.variant_ids && media.variant_ids.includes(variant.id)
        );
        
        variantMedia.forEach(media => {
          // Avoid duplicates
          if (!images.find(img => img.src === media.src)) {
            images.push({
              ...media,
              type: 'variant_media'
            });
          }
        });
      }
      
      // 3. If no specific images, try to match by color/option
      if (images.length === 0 && this.productData.media) {
        const matchedImages = this.findImagesByVariantOptions(variant);
        images.push(...matchedImages);
      }
      
      return images;
    }

    // NEW: Find images by matching variant option names (like color)
    findImagesByVariantOptions(variant) {
      const images = [];
      
      if (!this.productData.options || !this.productData.media) return images;
      
      // Get variant options
      const variantOptions = variant.options || [];
      
      // Look for images with alt text matching variant options
      this.productData.media.forEach(media => {
        if (media.alt) {
          const altText = media.alt.toLowerCase();
          const matchesOption = variantOptions.some(option => {
            if (!option) return false;
            const optionText = option.toString().toLowerCase();
            return altText.includes(optionText) || optionText.includes(altText);
          });
          
          if (matchesOption) {
            images.push({
              ...media,
              type: 'option_matched'
            });
          }
        }
      });
      
      return images;
    }

    setDefaultImage() {
      if (this.primaryImage && this.primaryImage.src) {
        this.defaultImage = {
          src: this.primaryImage.src,
          srcset: this.primaryImage.srcset,
          alt: this.primaryImage.alt,
          width: this.primaryImage.width,
          height: this.primaryImage.height
        };
      }
      
      if (this.secondaryImage && this.secondaryImage.src && this.secondaryImage !== this.primaryImage) {
        this.defaultSecondaryImage = {
          src: this.secondaryImage.src,
          srcset: this.secondaryImage.srcset,
          alt: this.secondaryImage.alt,
          width: this.secondaryImage.width,
          height: this.secondaryImage.height
        };
      }
    }

    // ... (keeping existing methods until updateVariantImage)

    preselectFirstAvailable() {
      if (!this.selectedVariant && this.variants.length) {
        const v = this.variants.find(v => v.available) || this.variants[0];
        if (!v) return;
        (this.productData?.options || []).forEach((name, idx) => {
          const key = name.toLowerCase();
          const val = v.options[idx];
          if (key.includes('size') || key.includes('größe')) {
            if (this.sizeSelect) this.sizeSelect.value = val;
          }
          if (key.includes('color') || key.includes('colour') || key.includes('farbe')) {
            const radio = Array.from(this.colorRadios).find(r => r.value === val);
            if (radio) radio.checked = true;
          }
        });
      }
    }

    getSelectedOptions() {
      const opts = {};
      if (this.sizeSelect && this.sizeSelect.value) opts.size = this.sizeSelect.value;
      const selColor = this.querySelector('.color-radio:checked');
      if (selColor) opts.color = selColor.value;
      return opts;
    }

    findMatchingVariant(selectedOptions) {
      const optionNames = (this.productData?.options || [])
        .map(o => (o || '').toString().toLowerCase().normalize('NFKD').replace(/[^\w]/g,''));
      return this.variants.find(variant => {
        return optionNames.every((on, idx) => {
          const key =
            on.includes('size') || on.includes('große') || on.includes('größe') ? 'size' :
            on.includes('color') || on.includes('colour') || on.includes('farbe') ? 'color' : null;
          if (!key || !selectedOptions[key]) return true;
          const norm = v => (v || '').toString().trim();
          return norm(variant.options[idx]) === norm(selectedOptions[key]);
        });
      });
    }

    updateVariantSelection() {
      const selectedOptions = this.getSelectedOptions();
      this.selectedVariant = this.findMatchingVariant(selectedOptions);
      this.updateUI();
    }

    updateUI() {
      this.updateAddToCartButton();
      this.updateStockStatus();
      this.updateVariantImage();
    }

    // ENHANCED: Improved variant image updating with better logic
    async updateVariantImage() {
      if (!this.primaryImage || !this.mediaContainer) return;

      this.showImageLoader(true);

      try {
        let primaryImageData = null;
        let secondaryImageData = null;

        if (this.selectedVariant) {
          // Get images for selected variant
          const variantImages = this.variantImages.get(this.selectedVariant.id) || [];
          
          if (variantImages.length > 0) {
            primaryImageData = variantImages[0]; // First image as primary
            secondaryImageData = variantImages[1] || null; // Second as hover if exists
            
            console.log(`Using variant images for variant ${this.selectedVariant.id}:`, variantImages);
          }
        }

        // Fallback logic
        if (!primaryImageData) {
          if (this.productData?.featured_media) {
            primaryImageData = this.productData.featured_media;
            if (this.productData.media && this.productData.media.length > 1) {
              secondaryImageData = this.productData.media[1];
            }
          } else if (this.defaultImage) {
            primaryImageData = this.defaultImage;
            secondaryImageData = this.defaultSecondaryImage;
          }
        }

        // Update images with smooth transition
        if (primaryImageData) {
          await this.updateImageElementSmooth(this.primaryImage, primaryImageData);
        }

        if (this.secondaryImage) {
          if (secondaryImageData) {
            await this.updateImageElementSmooth(this.secondaryImage, secondaryImageData);
            this.secondaryImage.style.display = '';
          } else {
           
          }
        }

        // Update price display for selected variant
        this.updateVariantPrice();

      } catch (error) {
        console.error('Error updating variant image:', error);
      } finally {
        this.showImageLoader(false);
      }
    }

    // NEW: Update price display
    updateVariantPrice() {
      const priceContainer = this.querySelector('.variant-price-main');
      const comparePriceContainer = this.querySelector('.variant-price-compare');
      
      if (this.selectedVariant && priceContainer) {
        // Format price (you may need to adjust this based on your shop's currency format)
        const price = (this.selectedVariant.price / 100).toFixed(2);
        priceContainer.textContent = `$${price}`;
        
        if (comparePriceContainer) {
          if (this.selectedVariant.compare_at_price > this.selectedVariant.price) {
            const comparePrice = (this.selectedVariant.compare_at_price / 100).toFixed(2);
            comparePriceContainer.textContent = `$${comparePrice}`;
            comparePriceContainer.style.display = '';
          } else {
            comparePriceContainer.style.display = 'none';
          }
        }
      }
    }

    // NEW: Smooth image transition
    async updateImageElementSmooth(imageElement, imageData) {
      return new Promise((resolve) => {
        if (!imageElement || !imageData || this.imageTransition) {
          resolve();
          return;
        }

        this.imageTransition = true;
        imageElement.classList.add('variant-image-transition');

        // Fade out
        imageElement.style.opacity = '0.3';

        setTimeout(() => {
          this.updateImageElement(imageElement, imageData);
          
          // Fade in
          imageElement.style.opacity = '1';
          
          setTimeout(() => {
            this.imageTransition = false;
            resolve();
          }, 300);
        }, 150);
      });
    }

    updateImageElement(imageElement, imageData) {
      if (!imageElement || !imageData) return;

      // Handle different image data formats
      if (imageData.src || imageData.url) {
        const baseUrl = imageData.src || imageData.url;
        
        if (baseUrl.includes('shopify') || baseUrl.includes('cdn')) {
          // Generate responsive srcset for Shopify images
          const sizes = [165, 360, 533, 720, 940, 1066];
          const srcsetParts = sizes
            .filter(size => size <= (imageData.width || 2048))
            .map(size => `${this.getShopifyImageUrl(baseUrl, size)} ${size}w`);
          
          imageElement.src = this.getShopifyImageUrl(baseUrl, 533);
          if (srcsetParts.length > 0) {
            imageElement.srcset = srcsetParts.join(', ');
          }
        } else {
          imageElement.src = baseUrl;
        }
        
        imageElement.alt = imageData.alt || this.selectedVariant?.title || this.productData?.title || '';
        
        if (imageData.width) imageElement.width = imageData.width;
        if (imageData.height) imageElement.height = imageData.height;
      }
    }

    getShopifyImageUrl(url, width) {
      if (!url || typeof url !== 'string') return url;
      
      let cleanUrl = url.replace(/_(pico|icon|thumb|small|compact|medium|large|grande|original|master|\d+x\d*|\d*x\d+|x\d+)\./g, '.');
      
      if (width) {
        cleanUrl = cleanUrl.replace(/(\.[^.]+)$/, `_${width}x$1`);
      }
      
      return cleanUrl;
    }

    // NEW: Show/hide image loader
    showImageLoader(show) {
      if (!this.imageLoader) return;
      this.imageLoader.style.display = show ? 'block' : '';
    }

    // NEW: Preload variant images for better performance
    preloadVariantImages() {
      if (this.variantImages.size === 0) return;
      
      this.variantImages.forEach((images, variantId) => {
        images.forEach(imageData => {
          if (imageData.src || imageData.url) {
            const img = new Image();
            img.src = this.getShopifyImageUrl(imageData.src || imageData.url, 533);
          }
        });
      });
    }

    // NEW: Get current variant image info for debugging
    getCurrentVariantImageInfo() {
      if (!this.selectedVariant) return null;
      
      return {
        variantId: this.selectedVariant.id,
        variantTitle: this.selectedVariant.title,
        images: this.variantImages.get(this.selectedVariant.id) || [],
        selectedOptions: this.getSelectedOptions()
      };
    }

    // ... (keeping all existing methods for cart functionality)
   updateAddToCartButton() {
  if (!this.addToCartBtn) return;
console.log("tigger")
  if (this.hasRequiredSelections()) {
    const btnText = this.addToCartBtn.querySelector('.btn-text');
    if (this.selectedVariant && this.selectedVariant.available) {
      
      btnText.innerHTML = '<span style="">ADD</span>';
      this.addToCartBtn.disabled = false;
         btnText.innerHTML = '<span style="">ADD</span>';
    } else {
      this.addToCartBtn.disabled = true;
         btnText.innerHTML = '<span style="">ADD</span>';
    }
  } else {
    this.addToCartBtn.disabled = true;
       btnText.innerHTML = '<span style="">ADD</span>';
  }
}


    hasRequiredSelections() {
      if (this.variants.length <= 1) return true;
      if (this.sizeSelect && !this.sizeSelect.value) return false;
      if (this.colorRadios.length && !this.querySelector('.color-radio:checked')) return false;
      return true;
    }

    updateStockStatus() {
      if (!this.outOfStockMsg) return;
      this.outOfStockMsg.style.display =
        this.selectedVariant && !this.selectedVariant.available ? 'block' : 'none';
    }

    async handleAddToCart(e) {
      e.preventDefault();
      if (!this.selectedVariant) return this.showMessage('Please select product options', 'error');
      if (!this.selectedVariant.available) return this.showMessage('Out of stock', 'error');
      
      const qty = 1;
      
      try {
        this.setLoadingState(true);
        
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        
        const isCartEmpty = await this.isCartEmpty();
        
        const formData = new FormData();
        formData.append('id', this.selectedVariant.id);
        formData.append('quantity', qty);
        
        if (this.cart) {
          const sectionsToRender = this.cart.getSectionsToRender ? this.cart.getSectionsToRender() : [];
          if (sectionsToRender.length) {
            formData.append('sections', sectionsToRender.map(section => section.id));
            formData.append('sections_url', window.location.pathname);
          }
        }
        
        const addUrl = window.routes?.cart_add_url || '/cart/add.js';
        
        const res = await fetch(addUrl, {
          method: 'POST',
          headers: { 
            'Accept': 'application/javascript',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: formData
        });
        
        if (res.ok) {
          const addResponse = await res.json();
          console.log('Add to cart response:', addResponse);
          
          if (addResponse.status) {
            console.error('Cart add error:', addResponse.errors || addResponse.description);
            this.showMessage(addResponse.description || 'Failed to add to cart', 'error');
            return;
          }
          
          if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
            publish(PUB_SUB_EVENTS.cartUpdate, {
              source: 'custom-product-card',
              productVariantId: this.selectedVariant.id,
              cartData: addResponse,
            });
          }
          
          if (this.cart && typeof this.cart.renderContents === 'function') {
            this.cart.renderContents(addResponse);
            console.log('Cart drawer/notification updated with Dawn method');
          }
          
          await this.updateCartCount();
          this.updateAddToCartButton();
          console.log('Cart operation completed');
          
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error('Add to cart failed:', res.status, errorData);
          this.showMessage(errorData.description || 'Failed to add to cart', 'error');
        }
      } catch (error) {
        console.error('Add to cart error:', error);
        this.showMessage('Failed to add to cart', 'error');
      } finally {
        if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
        this.setLoadingState(false);
      }
    }

    async isCartEmpty() {
      try {
        const res = await fetch('/cart.js');
        const cart = await res.json();
        return cart.item_count === 0;
      } catch(e) {
        console.error('Failed to check cart status:', e);
        return false;
      }
    }

    setLoadingState(loading) {
      if (!this.addToCartBtn) return;
      const btnText = this.addToCartBtn.querySelector('.btn-text');
      if (loading) {
        console.log("tiggerv 1")
        this.addToCartBtn.disabled = true;
        if (btnText) btnText.innerHTML = '<span style="color:#000">Adding...</span>';
      } else {
        this.updateAddToCartButton();
      }
    }

    showMessage(msg, type) {
      let el = this.querySelector('.cart-message');
      if (!el) {
        el = document.createElement('div');
        el.className = 'cart-message';
        (this.form || this).appendChild(el);
      }
      el.textContent = msg;
      el.className = `cart-message cart-message--${type}`;
      setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
    }

    async updateCartCount() {
      try {
        const res = await fetch('/cart.js');
        const cart = await res.json();
        console.log('Cart quantity update:', cart.item_count);
        
        const el = document.querySelector('.cart-count, [data-cart-count], .cart-count-badge');
        if (el) {
          el.textContent = cart.item_count;
          console.log('Cart icon updated with count:', cart.item_count);
        } else {
          console.warn('Cart count element not found');
        }
        
        return cart;
      } catch(e) { 
        console.error('Failed to update cart count:', e);
        return null;
      }
    }
  }

  if (!customElements.get('sale-product-card')) {
    customElements.define('sale-product-card', SaleProductCard);
  }
});










document.addEventListener('DOMContentLoaded', function() {
  // Handle custom cart button clicks
  document.addEventListener('click', function(e) {
    if (e.target.closest('.custom-cart-button')) {
      const button = e.target.closest('.custom-cart-button');
      const variantId = button.dataset.variantId;
      const productId = button.dataset.productId;
      
      if (button.disabled) return;
      
      // Store original button state
      const originalText = button.textContent;
      const originalHtml = button.innerHTML;
      
      // Disable button and show loading state
      button.disabled = true;
      button.classList.add('loading');
      
      // Update button text to show loading
      const btnText = button.querySelector('.btn-text') || button;
      btnText.textContent = 'Adding...';
      
      // Get cart components for updates
      const cart = document.querySelector('cart-notification') || 
                   document.querySelector('cart-drawer') || 
                   document.querySelector('cart-popup');
      
      // Prepare form data with sections for cart updates
      const formData = new FormData();
      formData.append('id', variantId);
      formData.append('quantity', 1);
      
      // Add sections to render if cart component exists
      if (cart && cart.getSectionsToRender) {
        const sectionsToRender = cart.getSectionsToRender();
        if (sectionsToRender.length) {
          formData.append('sections', sectionsToRender.map(section => section.id));
          formData.append('sections_url', window.location.pathname);
        }
      }
      
      // Check if cart is currently empty for proper state management
      isCartEmpty()
        .then(cartEmpty => {
          // Add to cart request
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: {
              'Accept': 'application/javascript',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
          });
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Check for cart API errors
          if (data.status) {
            throw new Error(data.description || 'Failed to add item to cart');
          }
          
          console.log('Added to cart:', data);
          
          // Success handling
          handleCartSuccess(button, data, cart, originalText, originalHtml);
        })
        .catch(error => {
          console.error('Error adding to cart:', error);
          handleCartError(button, error, originalText, originalHtml);
        });
    }
  });
  
  // Helper function to check if cart is empty
  async function isCartEmpty() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      return cart.item_count === 0;
    } catch (error) {
      console.error('Failed to check cart status:', error);
      return false;
    }
  }
  
  // Handle successful cart addition
  function handleCartSuccess(button, cartData, cartComponent, originalText, originalHtml) {
    // Show success state
    button.classList.remove('loading');
    button.classList.add('success');
    
    const btnText = button.querySelector('.btn-text') || button;
    btnText.textContent = 'Added!';
    
    // Publish cart update event for theme compatibility
    if (typeof publish !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'custom-cart-button',
        productVariantId: cartData.variant_id || cartData.id,
        cartData: cartData,
      });
    }
    
    // Update cart drawer/notification if available
    if (cartComponent) {
      // Remove empty state if cart was empty
      if (cartComponent.classList.contains('is-empty')) {
        cartComponent.classList.remove('is-empty');
      }
      
      // Update cart contents using theme's method
      if (typeof cartComponent.renderContents === 'function') {
        cartComponent.renderContents(cartData);
      }
      
      // Open cart drawer/notification
      if (typeof cartComponent.open === 'function') {
        cartComponent.open();
      } else if (cartComponent.classList.contains('cart-drawer')) {
        cartComponent.classList.add('active', 'animate');
        document.body.classList.add('overflow-hidden');
      } else if (cartComponent.classList.contains('cart-notification')) {
        cartComponent.classList.add('animate', 'active');
      }
    }
    
    // Update cart count in header
    updateCartCount();
    
    // Show success notification using Dawn's existing system
    // showCartNotification('Item added to cart!', 'success', cartData);
    
    // Dispatch custom cart updated event
    document.dispatchEvent(new CustomEvent('cart:updated', {
      detail: {
        cartData: cartData,
        source: 'custom-cart-button'
      }
    }));
    
    // Reset button after delay
    setTimeout(() => {
      resetButton(button, originalText, originalHtml);
    }, 2000);
  }
  
  // Handle cart addition errors
  function handleCartError(button, error, originalText, originalHtml) {
    button.classList.remove('loading');
    button.classList.add('error');
    
    const btnText = button.querySelector('.btn-text') || button;
    btnText.textContent = 'Error';
    
    // Log error (Dawn theme will handle error display through cart component)
    const errorMessage = error.message || 'Failed to add item to cart';
    console.error('Cart error:', errorMessage);
    
    // Reset button after delay
    setTimeout(() => {
      resetButton(button, originalText, originalHtml);
    }, 3000);
  }
  
  // Reset button to original state
  function resetButton(button, originalText, originalHtml) {
    button.disabled = false;
    button.classList.remove('loading', 'success', 'error');
    
    // Restore original content
    if (button.querySelector('.btn-text')) {
      button.querySelector('.btn-text').textContent = originalText;
    } else {
      button.innerHTML = originalHtml;
    }
  }
  
  // Update cart count in header
  async function updateCartCount() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      
      // Update various possible cart count selectors
      const cartCountSelectors = [
        '.cart-count',
        '[data-cart-count]',
        '.cart-count-badge',
        '.cart-link__bubble',
        '.cart-count-bubble'
      ];
      
      cartCountSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.textContent = cart.item_count;
          
          // Show/hide cart count bubble
          if (cart.item_count > 0) {
            element.classList.remove('hidden');
            element.style.display = '';
          } else {
            element.classList.add('hidden');
          }
        });
      });
      
      console.log('Cart count updated:', cart.item_count);
      return cart;
    } catch (error) {
      console.error('Failed to update cart count:', error);
      return null;
    }
  }
  
  // Use Dawn theme's existing notification system
  function showCartNotification(message, type = 'success', cartData = null) {
    // Try to use Dawn's cart notification system
    const cartNotification = document.querySelector('cart-notification');
    
    if (cartNotification && typeof cartNotification.renderContents === 'function') {
      // Use Dawn's built-in notification - it will show automatically after cart update
      return;
    }
    
    // Fallback: Use browser's built-in notifications or simple alert for errors
    if (type === 'error') {
      console.error(message);
      // You could add a simple CSS-only notification here if needed
    } else {
      console.log(message);
    }
  }
  
  // Add minimal button loading styles only
  function addButtonStyles() {
    
    
    
  }
  
  // Initialize cart state management
  function initCartState() {
    // Add minimal button styles
    addButtonStyles();
    
    // Listen for cart updates from other sources
    document.addEventListener('cart:updated', function(e) {
      updateCartCount();
    });
    
    // Handle page visibility changes to sync cart state
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        updateCartCount();
      }
    });
  }
  
  // Initialize when DOM is ready
  initCartState();
});