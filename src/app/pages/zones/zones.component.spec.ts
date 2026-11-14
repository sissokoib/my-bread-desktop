import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ZonesComponent } from './zones.component';

describe('ZonesComponent', () => {
  let component: ZonesComponent;
  let fixture: ComponentFixture<ZonesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZonesComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(ZonesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
