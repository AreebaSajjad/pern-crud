async function fetchProductPrice(productId) {
  try {
    const res = await fetch(`https://api.example.com/products/${productId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch product: ${res.status}`);
    }
    const data = await res.json();
    return data.price;
  } catch (error) {
    console.error('Error fetching product price:', error.message);
    throw error;
  }
}

module.exports = { fetchProductPrice };