#!/usr/bin/env ruby
# Adds ProyouWidget extension target to App.xcodeproj
# Run: ruby ios/patch-widget-project.rb

project_path = File.expand_path("App/App.xcodeproj/project.pbxproj", __dir__)
content = File.read(project_path)
exit 0 if content.include?("ProyouWidgetExtension")

# Fixed 24-char IDs (hex)
W = {
  snapshot_ref: "A1WGT0011FED79650016851F",
  snapshot_app: "A1WGT0021FED79650016851F",
  snapshot_wgt: "A1WGT0031FED79650016851F",
  plugin_ref: "A1WGT0041FED79650016851F",
  plugin_app: "A1WGT0051FED79650016851F",
  widget_swift_ref: "A1WGT0061FED79650016851F",
  widget_swift_wgt: "A1WGT0071FED79650016851F",
  widget_plist_ref: "A1WGT0081FED79650016851F",
  widget_ent_ref: "A1WGT0091FED79650016851F",
  widget_product: "A1WGT00A1FED79650016851F",
  widget_target: "A1WGT00B1FED79650016851F",
  widget_sources: "A1WGT00C1FED79650016851F",
  widget_resources: "A1WGT00D1FED79650016851F",
  widget_frameworks: "A1WGT00E1FED79650016851F",
  embed_phase: "A1WGT00F1FED79650016851F",
  embed_file: "A1WGT0101FED79650016851F",
  proxy: "A1WGT0111FED79650016851F",
  dependency: "A1WGT0121FED79650016851F",
  shared_group: "A1WGT0131FED79650016851F",
  widget_group: "A1WGT0141FED79650016851F",
  widget_debug: "A1WGT0151FED79650016851F",
  widget_release: "A1WGT0161FED79650016851F",
  widget_config_list: "A1WGT0171FED79650016851F",
}

pb = content.dup

pb.sub!("/* End PBXBuildFile section */", <<~BLOCK)
\t\t#{W[:snapshot_app]} /* ProyouWidgetSnapshot.swift in Sources */ = {isa = PBXBuildFile; fileRef = #{W[:snapshot_ref]} /* ProyouWidgetSnapshot.swift */; };
\t\t#{W[:plugin_app]} /* ProyouWidgetPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = #{W[:plugin_ref]} /* ProyouWidgetPlugin.swift */; };
\t\t#{W[:snapshot_wgt]} /* ProyouWidgetSnapshot.swift in Sources */ = {isa = PBXBuildFile; fileRef = #{W[:snapshot_ref]} /* ProyouWidgetSnapshot.swift */; };
\t\t#{W[:widget_swift_wgt]} /* ProyouWidget.swift in Sources */ = {isa = PBXBuildFile; fileRef = #{W[:widget_swift_ref]} /* ProyouWidget.swift */; };
\t\t#{W[:embed_file]} /* ProyouWidgetExtension.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = #{W[:widget_product]} /* ProyouWidgetExtension.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
/* End PBXBuildFile section */
BLOCK

pb.sub!("/* End PBXFileReference section */", <<~BLOCK)
\t\t#{W[:snapshot_ref]} /* ProyouWidgetSnapshot.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ProyouWidgetSnapshot.swift; sourceTree = "<group>"; };
\t\t#{W[:plugin_ref]} /* ProyouWidgetPlugin.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ProyouWidgetPlugin.swift; sourceTree = "<group>"; };
\t\t#{W[:widget_swift_ref]} /* ProyouWidget.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ProyouWidget.swift; sourceTree = "<group>"; };
\t\t#{W[:widget_plist_ref]} /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
\t\t#{W[:widget_ent_ref]} /* ProyouWidget.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = ProyouWidget.entitlements; sourceTree = "<group>"; };
\t\t#{W[:widget_product]} /* ProyouWidgetExtension.appex */ = {isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = ProyouWidgetExtension.appex; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */
BLOCK

pb.sub!(
  "504EC3051FED79650016851F /* Products */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t504EC3041FED79650016851F /* App.app */,",
  "504EC3051FED79650016851F /* Products */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t504EC3041FED79650016851F /* App.app */,\n\t\t\t\t#{W[:widget_product]} /* ProyouWidgetExtension.appex */,"
)

pb.sub!(
  "504EC2FB1FED79650016851F = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t504EC3061FED79650016851F /* App */,",
  "504EC2FB1FED79650016851F = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t504EC3061FED79650016851F /* App */,\n\t\t\t\t#{W[:shared_group]} /* Shared */,\n\t\t\t\t#{W[:widget_group]} /* ProyouWidget */,"
)

pb.sub!(
  "B04EC31A1FED79650016851F /* ProyouApnsPlugin.swift */,\n\t\t\t\t504EC30B1FED79650016851F /* Main.storyboard */,",
  "B04EC31A1FED79650016851F /* ProyouApnsPlugin.swift */,\n\t\t\t\t#{W[:plugin_ref]} /* ProyouWidgetPlugin.swift */,\n\t\t\t\t504EC30B1FED79650016851F /* Main.storyboard */,"
)

pb.sub!("/* End PBXGroup section */", <<~BLOCK)
\t\t#{W[:shared_group]} /* Shared */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t#{W[:snapshot_ref]} /* ProyouWidgetSnapshot.swift */,
\t\t\t);
\t\t\tpath = Shared;
\t\t\tsourceTree = "<group>";
\t\t};
\t\t#{W[:widget_group]} /* ProyouWidget */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t#{W[:widget_swift_ref]} /* ProyouWidget.swift */,
\t\t\t\t#{W[:widget_plist_ref]} /* Info.plist */,
\t\t\t\t#{W[:widget_ent_ref]} /* ProyouWidget.entitlements */,
\t\t\t);
\t\t\tpath = ProyouWidget;
\t\t\tsourceTree = "<group>";
\t\t};
/* End PBXGroup section */
BLOCK

pb.sub!(
  "504EC3021FED79650016851F /* Resources */,\n\t\t\t\t9592DBEFFC6D2A0C8D5DEB22 /* [CP] Embed Pods Frameworks */,",
  "504EC3021FED79650016851F /* Resources */,\n\t\t\t\t9592DBEFFC6D2A0C8D5DEB22 /* [CP] Embed Pods Frameworks */,\n\t\t\t\t#{W[:embed_phase]} /* Embed Foundation Extensions */,"
)

pb.sub!(
  "dependencies = (\n\t\t\t);",
  "dependencies = (\n\t\t\t\t#{W[:dependency]} /* PBXTargetDependency */,\n\t\t\t);"
)

pb.sub!(
  "B04EC31C1FED79650016851F /* ProyouApnsPlugin.swift in Sources */,\n\t\t\t);",
  "B04EC31C1FED79650016851F /* ProyouApnsPlugin.swift in Sources */,\n\t\t\t\t#{W[:snapshot_app]} /* ProyouWidgetSnapshot.swift in Sources */,\n\t\t\t\t#{W[:plugin_app]} /* ProyouWidgetPlugin.swift in Sources */,\n\t\t\t);"
)

pb.sub!("/* End PBXNativeTarget section */", <<~BLOCK)
\t\t#{W[:widget_target]} /* ProyouWidgetExtension */ = {
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = #{W[:widget_config_list]} /* Build configuration list for PBXNativeTarget "ProyouWidgetExtension" */;
\t\t\tbuildPhases = (
\t\t\t\t#{W[:widget_sources]} /* Sources */,
\t\t\t\t#{W[:widget_frameworks]} /* Frameworks */,
\t\t\t\t#{W[:widget_resources]} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = ProyouWidgetExtension;
\t\t\tproductName = ProyouWidgetExtension;
\t\t\tproductReference = #{W[:widget_product]} /* ProyouWidgetExtension.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t};
/* End PBXNativeTarget section */
BLOCK

pb.sub!(
  "targets = (\n\t\t\t\t504EC3031FED79650016851F /* App */,\n\t\t\t);",
  "targets = (\n\t\t\t\t504EC3031FED79650016851F /* App */,\n\t\t\t\t#{W[:widget_target]} /* ProyouWidgetExtension */,\n\t\t\t);"
)

pb.sub!(
  "504EC3031FED79650016851F = {\n\t\t\t\t\t\tCreatedOnToolsVersion = 9.2;\n\t\t\t\t\t\tLastSwiftMigration = 1100;\n\t\t\t\t\t\tProvisioningStyle = Automatic;\n\t\t\t\t\t};",
  "504EC3031FED79650016851F = {\n\t\t\t\t\t\tCreatedOnToolsVersion = 9.2;\n\t\t\t\t\t\tLastSwiftMigration = 1100;\n\t\t\t\t\t\tProvisioningStyle = Automatic;\n\t\t\t\t\t};\n\t\t\t\t\t#{W[:widget_target]} = {\n\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;\n\t\t\t\t\t\tProvisioningStyle = Automatic;\n\t\t\t\t\t};"
)

pb.sub!("/* Begin PBXFrameworksBuildPhase section */", <<~BLOCK)
/* Begin PBXCopyFilesBuildPhase section */
\t\t#{W[:embed_phase]} /* Embed Foundation Extensions */ = {
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t#{W[:embed_file]} /* ProyouWidgetExtension.appex in Embed Foundation Extensions */,
\t\t\t);
\t\t\tname = "Embed Foundation Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 13;
\t\t};
/* End PBXCopyFilesBuildPhase section */

/* Begin PBXContainerItemProxy section */
\t\t#{W[:proxy]} /* PBXContainerItemProxy */ = {
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = 504EC2FC1FED79650016851F /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = #{W[:widget_target]};
\t\t\tremoteInfo = ProyouWidgetExtension;
\t\t};
/* End PBXContainerItemProxy section */

/* Begin PBXTargetDependency section */
\t\t#{W[:dependency]} /* PBXTargetDependency */ = {
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = #{W[:widget_target]} /* ProyouWidgetExtension */;
\t\t\ttargetProxy = #{W[:proxy]} /* PBXContainerItemProxy */;
\t\t};
/* End PBXTargetDependency section */

/* Begin PBXFrameworksBuildPhase section */
BLOCK

pb.sub!("/* End PBXResourcesBuildPhase section */", <<~BLOCK)
\t\t#{W[:widget_resources]} /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXResourcesBuildPhase section */
BLOCK

pb.sub!("/* End PBXSourcesBuildPhase section */", <<~BLOCK)
\t\t#{W[:widget_sources]} /* Sources */ = {
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t#{W[:snapshot_wgt]} /* ProyouWidgetSnapshot.swift in Sources */,
\t\t\t\t#{W[:widget_swift_wgt]} /* ProyouWidget.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXSourcesBuildPhase section */
BLOCK

pb.sub!(
  "504EC3011FED79650016851F /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t\tA084ECDBA7D38E1E42DFC39D /* Pods_App.framework in Frameworks */,\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n/* End PBXFrameworksBuildPhase section */",
  "504EC3011FED79650016851F /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t\tA084ECDBA7D38E1E42DFC39D /* Pods_App.framework in Frameworks */,\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n\t\t#{W[:widget_frameworks]} /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};\n/* End PBXFrameworksBuildPhase section */"
)

pb.sub!("/* End XCBuildConfiguration section */", <<~BLOCK)
\t\t#{W[:widget_debug]} /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tCODE_SIGN_ENTITLEMENTS = ProyouWidget/ProyouWidget.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_TEAM = HF3AKH98PY;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = ProyouWidget/Info.plist;
\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = PROYOU;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 14.0;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@executable_path/../../Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 10.5;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = app.proyou.proyou.ProyouWidget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\t#{W[:widget_release]} /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tCODE_SIGN_ENTITLEMENTS = ProyouWidget/ProyouWidget.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_TEAM = HF3AKH98PY;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = ProyouWidget/Info.plist;
\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = PROYOU;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 14.0;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@executable_path/../../Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 10.5;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = app.proyou.proyou.ProyouWidget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t};
\t\t\tname = Release;
\t\t};
/* End XCBuildConfiguration section */
BLOCK

pb.sub!("/* End XCConfigurationList section */", <<~BLOCK)
\t\t#{W[:widget_config_list]} /* Build configuration list for PBXNativeTarget "ProyouWidgetExtension" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t#{W[:widget_debug]} /* Debug */,
\t\t\t\t#{W[:widget_release]} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
/* End XCConfigurationList section */
BLOCK

File.write(project_path, pb)
puts "Patched #{project_path}"
