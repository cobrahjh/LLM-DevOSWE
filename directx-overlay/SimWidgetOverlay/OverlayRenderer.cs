namespace SimWidgetOverlay
{
    /// <summary>
    /// Overlay rendering utilities (for future expansion)
    /// </summary>
    public class OverlayRenderer
    {
        public bool Visible { get; set; } = true;
        public float X { get; set; } = 50;
        public float Y { get; set; } = 100;
        public float Width { get; set; } = 280;
        public float Height { get; set; } = 400;
        
        // Toggle key (F10 by default)
        public int ToggleKey { get; set; } = 0x79; // VK_F10
        
        public OverlayRenderer()
        {
            // Future: Load settings from file
        }
        
        public void Toggle()
        {
            Visible = !Visible;
        }
        
        public void SetPosition(float x, float y)
        {
            X = x;
            Y = y;
        }
    }
}
