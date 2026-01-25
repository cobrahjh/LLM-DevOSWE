Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

# Commands
$commands = @{
    "calc" = @{ Name = "Calculator"; Run = "calc.exe" }
    "cmd" = @{ Name = "Command Prompt"; Run = "cmd.exe" }
    "notepad" = @{ Name = "Notepad"; Run = "notepad.exe" }
    "explorer" = @{ Name = "File Explorer"; Run = "explorer.exe" }
    "settings" = @{ Name = "Settings"; Run = "ms-settings:" }
    "task" = @{ Name = "Task Manager"; Run = "taskmgr.exe" }
    "term" = @{ Name = "Terminal"; Run = "wt.exe" }
    "code" = @{ Name = "VS Code"; Run = "code" }
    "chrome" = @{ Name = "Chrome"; Run = "chrome.exe" }
    "edge" = @{ Name = "Edge"; Run = "msedge.exe" }
}

[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Quick Search"
        Width="400" Height="50"
        WindowStyle="None"
        AllowsTransparency="True"
        Background="Transparent"
        Topmost="True"
        ShowInTaskbar="False"
        ResizeMode="NoResize"
        WindowStartupLocation="Manual">
    <Window.Resources>
        <Style TargetType="ListBoxItem">
            <Setter Property="Background" Value="Transparent"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="Padding" Value="12,8"/>
            <Setter Property="FontSize" Value="13"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Style.Triggers>
                <Trigger Property="IsSelected" Value="True">
                    <Setter Property="Background" Value="#3a3a4e"/>
                </Trigger>
                <Trigger Property="IsMouseOver" Value="True">
                    <Setter Property="Background" Value="#2a2a3e"/>
                </Trigger>
            </Style.Triggers>
        </Style>
    </Window.Resources>
    <Border CornerRadius="12" Background="#e01a1a2e" BorderBrush="#333" BorderThickness="1">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height="50"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <!-- Search Box -->
            <Border Grid.Row="0" Background="#2a2a3e" CornerRadius="10" Margin="5">
                <Grid>
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width="40"/>
                        <ColumnDefinition Width="*"/>
                        <ColumnDefinition Width="30"/>
                    </Grid.ColumnDefinitions>
                    <TextBlock Grid.Column="0" Text="🔍" FontSize="16" VerticalAlignment="Center" HorizontalAlignment="Center" Foreground="#667eea"/>
                    <TextBox Grid.Column="1" Name="SearchBox" Background="Transparent" BorderThickness="0" Foreground="White" FontSize="14" VerticalAlignment="Center" CaretBrush="White"/>
                    <Button Grid.Column="2" Name="CloseBtn" Content="✕" Background="Transparent" BorderThickness="0" Foreground="#888" FontSize="14" Cursor="Hand" VerticalAlignment="Center"/>
                </Grid>
            </Border>

            <!-- Results -->
            <Border Grid.Row="1" Name="ResultsBorder" Background="#1e1e2e" CornerRadius="0,0,10,10" Visibility="Collapsed" MaxHeight="300">
                <ListBox Name="ResultsList" Background="Transparent" BorderThickness="0" ScrollViewer.HorizontalScrollBarVisibility="Disabled"/>
            </Border>
        </Grid>
    </Border>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)

# Get controls
$searchBox = $window.FindName("SearchBox")
$resultsList = $window.FindName("ResultsList")
$resultsBorder = $window.FindName("ResultsBorder")
$closeBtn = $window.FindName("CloseBtn")

# Position top-center
$window.Left = ([System.Windows.SystemParameters]::PrimaryScreenWidth - $window.Width) / 2
$window.Top = 20

# Make window draggable
$window.Add_MouseLeftButtonDown({ $window.DragMove() })

# Close button
$closeBtn.Add_Click({ $window.Hide() })

# Search logic
$searchBox.Add_TextChanged({
    $query = $searchBox.Text.ToLower()
    $resultsList.Items.Clear()

    if ([string]::IsNullOrWhiteSpace($query)) {
        $resultsBorder.Visibility = "Collapsed"
        $window.Height = 50
        return
    }

    $matches = @()

    # Web search prefix
    if ($query.StartsWith("?")) {
        $webQuery = $query.Substring(1)
        if ($webQuery.Length -gt 0) {
            $matches += @{ Name = "🔍 Google: $webQuery"; Run = "https://www.google.com/search?q=$webQuery" }
        }
    } else {
        # Search commands
        foreach ($key in $commands.Keys) {
            $cmd = $commands[$key]
            if ($key -like "*$query*" -or $cmd.Name -like "*$query*") {
                $matches += @{ Name = "▸ $($cmd.Name)"; Run = $cmd.Run }
            }
        }

        # Fallback to web search
        if ($matches.Count -eq 0) {
            $matches += @{ Name = "🔍 Search: $query"; Run = "https://www.google.com/search?q=$query" }
        }
    }

    if ($matches.Count -gt 0) {
        foreach ($m in $matches) {
            $item = New-Object System.Windows.Controls.ListBoxItem
            $item.Content = $m.Name
            $item.Tag = $m.Run
            $item.Add_MouseDoubleClick({
                param($sender, $e)
                Start-Process $sender.Tag
                $searchBox.Text = ""
                $resultsBorder.Visibility = "Collapsed"
                $window.Height = 50
            })
            $resultsList.Items.Add($item)
        }
        $resultsBorder.Visibility = "Visible"
        $window.Height = 50 + [Math]::Min($matches.Count * 35, 250)
    } else {
        $resultsBorder.Visibility = "Collapsed"
        $window.Height = 50
    }
})

# Keyboard navigation
$searchBox.Add_PreviewKeyDown({
    param($sender, $e)

    if ($e.Key -eq "Down" -and $resultsList.Items.Count -gt 0) {
        if ($resultsList.SelectedIndex -lt $resultsList.Items.Count - 1) {
            $resultsList.SelectedIndex++
        }
        $e.Handled = $true
    }
    elseif ($e.Key -eq "Up" -and $resultsList.Items.Count -gt 0) {
        if ($resultsList.SelectedIndex -gt 0) {
            $resultsList.SelectedIndex--
        }
        $e.Handled = $true
    }
    elseif ($e.Key -eq "Enter" -and $resultsList.SelectedItem) {
        Start-Process $resultsList.SelectedItem.Tag
        $searchBox.Text = ""
        $resultsBorder.Visibility = "Collapsed"
        $window.Height = 50
        $e.Handled = $true
    }
    elseif ($e.Key -eq "Escape") {
        $searchBox.Text = ""
        $resultsBorder.Visibility = "Collapsed"
        $window.Height = 50
        $e.Handled = $true
    }
})

# Focus search box on show
$window.Add_Activated({ $searchBox.Focus() })

# Show window
$window.ShowDialog()
