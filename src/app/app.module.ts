import { NgModule } from '@angular/core';
import { RouteReuseStrategy } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule, HammerModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { IonicStorageModule } from '@ionic/storage-angular';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { SQLite } from '@awesome-cordova-plugins/sqlite/ngx';
import { WebView } from '@awesome-cordova-plugins/ionic-webview/ngx';
import { SQLitePorter } from '@awesome-cordova-plugins/sqlite-porter/ngx';

import { EpubService } from './services/epub.service';
import { DatabaseService } from './services/database.service';
import { DirectoryService } from './services/directory.service';
import { FileReaderService } from './services/file-reader.service';
import { WebScraperService } from './services/web-scraper.service';

import { AppRoutingModule } from 'src/app/app-routing.module';

import { AppComponent } from 'src/app/app.component';

import { registerLocaleData } from '@angular/common';

import localeCs from '@angular/common/locales/cs';
registerLocaleData(localeCs);


@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        IonicModule.forRoot(),
        AppRoutingModule,
        BrowserAnimationsModule,
        IonicStorageModule.forRoot(),
        HammerModule,
        HttpClientModule,
    ],
    providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        DatabaseService,
        DirectoryService,
        EpubService,
        FileReaderService,
        SQLite,
        SQLitePorter,
        WebScraperService,
        WebView,
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
